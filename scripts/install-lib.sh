# install-lib.sh — install.sh's second half: swaps current/ and previous/, registers the my-mods
# marketplace, installs/updates/removes the plugins, rolls back and prints the summary.
# shellcheck shell=sh
# Not run on its own: install.sh finds this file and loads it with `.` (POSIX sh; macOS bash 3.2 is fine).
#
# Contract — install.sh sets before loading:
#   variables  REPO MARKET ALL_PLUGINS RETIRED MODE DRY DIR TMP PLUGINS PLUGINS_ARG
#              HAVE_CLAUDE LATEST_TAG BUNDLE BUNDLE_VERSION (BUNDLE empty = no bundle, dry run only)
#   functions  say warn die have is_bundle gh_ready api_get release_tag
# This file provides (called by install.sh after loading):
#   lib_mode_install    swap BUNDLE into DIR/current, register the marketplace, install PLUGINS
#   lib_mode_rollback   swap DIR/current and DIR/previous, register, update the installed PLUGINS
#   lib_mode_uninstall  remove every MARKET plugin (keeping data), the marketplace and DIR
# Each mode first recovers a swap that was interrupted between its moves.

[ -n "${MARKET:-}" ] && [ -n "${DIR:-}" ] || {
  printf '%s\n' "install-lib.sh is loaded by install.sh; run: sh install.sh --help" >&2; exit 1
}

# Deletes a path only when it sits inside the install folder.
rm_in_dir() {
  if [ -z "$DIR" ] || [ -z "$1" ]; then die "internal: empty path to delete"; fi
  case $1 in "$DIR"/?*) ;; *) die "internal: refusing to delete '$1' (outside $DIR)" ;; esac
  [ -e "$1" ] || return 0
  rm -rf -- "$1"
}
rm_marked() { [ ! -e "$1" ] || is_bundle "$1" || die "$1 is not a my-mods install; not touching it"; rm_in_dir "$1"; }

# Prints and runs a command; with --dry-run only prints it.
FAILED=0
run() {
  if [ "$DRY" = 1 ]; then say "would run: $*"; return 0; fi
  say "run: $*"
  "$@" || { warn "failed (exit $?): $*"; FAILED=1; return 1; }
}

# ---- step 5: swap current/ -> previous/, new -> current/ ----
same_dir() { # both exist and resolve to the same place
  [ -d "$1" ] && [ -d "$2" ] && [ "$(cd "$1" && pwd -P)" = "$(cd "$2" && pwd -P)" ]
}

# A swap stopped between its moves leaves no current/ and the old previous/ in .old-previous/:
# put previous/ back as current/ and .old-previous/ back as previous/.
recover_swap() {
  [ ! -e "$DIR/current" ] && [ -d "$DIR/.old-previous" ] || return 0
  is_bundle "$DIR/.old-previous" || die "$DIR/.old-previous is not a my-mods install; not touching it"
  if [ "$DRY" = 1 ]; then say "would recover an interrupted install in $DIR (previous/ -> current/, .old-previous/ -> previous/)"; return 0; fi
  say "recovering an interrupted install in $DIR"
  if [ -d "$DIR/previous" ]; then
    is_bundle "$DIR/previous" || die "$DIR/previous is not a my-mods install; not touching it"
    mv "$DIR/previous" "$DIR/current" || die "cannot move $DIR/previous back to current/"
  fi
  mv "$DIR/.old-previous" "$DIR/previous" || die "cannot move $DIR/.old-previous back to previous/"
  rm_in_dir "$DIR/.staging"
}

swap_in() { # swap_in <bundle dir>
  if same_dir "$1" "$DIR/current"; then say "the bundle is already $DIR/current"; return 0; fi
  if [ "$DRY" = 1 ]; then
    if [ -d "$DIR/current" ]; then say "would move $DIR/current to $DIR/previous (replacing the old previous/)"; fi
    say "would copy the bundle to $DIR/current"; return 0
  fi
  mkdir -p "$DIR" || die "cannot create $DIR"
  rm_in_dir "$DIR/.staging"; rm_marked "$DIR/.old-previous"
  cp -R "$1" "$DIR/.staging" || { rm_in_dir "$DIR/.staging"; die "cannot copy the bundle into $DIR"; }
  if [ -d "$DIR/previous" ]; then mv "$DIR/previous" "$DIR/.old-previous" || die "cannot move $DIR/previous aside"; fi
  if [ -d "$DIR/current" ] && ! mv "$DIR/current" "$DIR/previous"; then
    if [ -d "$DIR/.old-previous" ]; then mv "$DIR/.old-previous" "$DIR/previous"; fi
    rm_in_dir "$DIR/.staging"; die "cannot move $DIR/current to previous/"
  fi
  if ! mv "$DIR/.staging" "$DIR/current"; then
    if [ -d "$DIR/previous" ]; then mv "$DIR/previous" "$DIR/current"; fi
    if [ -d "$DIR/.old-previous" ]; then mv "$DIR/.old-previous" "$DIR/previous"; fi
    rm_in_dir "$DIR/.staging"; die "cannot put the new version in place; the old one is restored"
  fi
  rm_marked "$DIR/.old-previous"
  say "installed into $DIR/current (the old one is in previous/)"
}

# ---- steps 6-7: marketplace and plugins ----
# The marketplace entry named my-mods as one line of `marketplace list --json` (flat objects).
market_entry() {
  claude plugin marketplace list --json 2>/dev/null | tr -d '\n' | tr '{}' '\n\n' |
    grep "\"name\"[[:space:]]*:[[:space:]]*\"$MARKET\""
}
market_path() {
  printf '%s\n' "$1" | sed -n 's/.*"path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}
# Plugin ids installed in user scope (one per line).
installed_user() {
  claude plugin list --json 2>/dev/null | tr -d '\n' | tr '{}' '\n\n' |
    grep '"scope"[[:space:]]*:[[:space:]]*"user"' |
    sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}
INSTALLED=""
is_installed() { printf '%s\n' "$INSTALLED" | grep -qx "$1@$MARKET"; }

register() {
  target="$DIR/current"
  if [ "$HAVE_CLAUDE" != 1 ]; then
    say "would register marketplace $MARKET at $target (add, or update if already there)"; return 0
  fi
  entry=$(market_entry)
  if [ -z "$entry" ]; then
    run claude plugin marketplace add "$target"
    return
  fi
  mp=$(market_path "$entry")
  if [ "$mp" = "$target" ] || same_dir "$mp" "$target"; then
    run claude plugin marketplace update "$MARKET"
  else # add without remove: only the source changes, installed plugins and /config values stay
    say "re-pointing $MARKET from '${mp:-a non-folder source}' to $target"
    run claude plugin marketplace add "$target"
  fi
}

install_plugins() { # install_plugins <names>; in rollback mode without --plugins only installed ones
  if [ "$HAVE_CLAUDE" != 1 ]; then
    for p in $1; do say "would install or update $p@$MARKET (user scope)"; done; return 0
  fi
  INSTALLED=$(installed_user)
  list=$1 moved=""
  if is_installed tcw; then # tcw -> qhud: qhud is installed even in a rollback without --plugins
    say "tcw was renamed qhud: removing tcw@$MARKET (its data is kept)"
    run claude plugin uninstall "tcw@$MARKET" --scope user --keep-data && moved=1
    case " $list " in *" qhud "*) ;; *) list="qhud $list" ;; esac
  fi
  for p in $list; do
    if is_installed "$p"; then
      # Claude Code copies plugins into its cache, so an installed one needs an update to pick up the new files.
      run claude plugin update "$p@$MARKET" --scope user
    elif [ "$MODE" = rollback ] && [ -z "$PLUGINS_ARG" ] && ! { [ "$p" = qhud ] && [ -n "$moved" ]; }; then
      :
    else
      run claude plugin install "$p@$MARKET" --scope user
    fi
  done
  for p in $RETIRED; do
    if is_installed "$p"; then
      say "$p is no longer part of $MARKET; to remove it run: claude plugin uninstall $p@$MARKET --scope user"
    fi
  done
}

latest_tag() {
  if [ -n "$LATEST_TAG" ]; then printf '%s\n' "$LATEST_TAG"; return; fi
  if [ "$DRY" = 1 ]; then echo "not checked (dry run)"; return; fi
  if gh_ready; then
    lt=$(gh release view --repo "$REPO" --json tagName --jq .tagName 2>/dev/null)
  elif [ -n "${GITHUB_TOKEN:-}" ] && { have curl || have wget; } &&
       api_get "https://api.github.com/repos/$REPO/releases/latest" "$TMP/latest.json" "application/vnd.github+json"; then
    lt=$(release_tag "$TMP/latest.json")
  fi
  printf '%s\n' "${lt:-unknown (log in with gh or set GITHUB_TOKEN to check)}"
}

finish() {
  cur="none"
  if [ -f "$DIR/current/VERSION" ]; then cur="v$(tr -d ' \t\r\n' < "$DIR/current/VERSION")"; fi
  if [ "$DRY" = 1 ] && [ -n "$BUNDLE_VERSION" ]; then cur="$cur (after this run: v$BUNDLE_VERSION)"; fi
  say "In a running Claude Code session run /reload-plugins, or open a new session."
  say "current $cur, latest $(latest_tag)"
  [ "$DRY" = 1 ] && say "dry run: nothing was changed"
  if [ "$FAILED" = 1 ]; then die "some steps failed (see the warnings above)"; fi
}

# ---- modes ----
lib_mode_install() {
  recover_swap
  if [ -n "$BUNDLE" ]; then
    swap_in "$BUNDLE"
  else
    say "would move $DIR/current to previous/ and put the new version in $DIR/current"
  fi
  register
  install_plugins "$PLUGINS"
  finish
}

lib_mode_rollback() {
  recover_swap
  [ -d "$DIR/previous" ] || {
    if [ "$DRY" = 1 ]; then warn "no $DIR/previous to roll back to; a real run stops here"; finish; return; fi
    die "no $DIR/previous to roll back to"
  }
  if [ "$DRY" = 1 ]; then
    say "would swap $DIR/current and $DIR/previous"
  else
    rm_marked "$DIR/.rollback"
    if [ -d "$DIR/current" ]; then mv "$DIR/current" "$DIR/.rollback" || die "cannot move $DIR/current aside"; fi
    if ! mv "$DIR/previous" "$DIR/current"; then
      if [ -d "$DIR/.rollback" ]; then mv "$DIR/.rollback" "$DIR/current"; fi
      die "cannot restore $DIR/previous; nothing changed"
    fi
    if [ -d "$DIR/.rollback" ]; then mv "$DIR/.rollback" "$DIR/previous" || warn "could not keep the newer version as previous/"; fi
    say "rolled back: $DIR/current is the previous version (the newer one is now previous/)"
  fi
  register
  install_plugins "$PLUGINS"
  finish
}

lib_mode_uninstall() {
  recover_swap
  if [ "$HAVE_CLAUDE" = 1 ]; then
    INSTALLED=$(installed_user)
    for p in $ALL_PLUGINS tcw; do
      if is_installed "$p"; then run claude plugin uninstall "$p@$MARKET" --scope user --keep-data; fi
    done
    if [ -n "$(market_entry)" ]; then run claude plugin marketplace remove "$MARKET"; fi
  else
    say "would uninstall $ALL_PLUGINS (keeping their data) and remove marketplace $MARKET"
  fi
  if [ "$DRY" = 1 ]; then
    say "would delete $DIR (current/ and previous/)"
  elif [ -d "$DIR" ]; then
    rm_in_dir "$DIR/.staging"; for d in current previous .old-previous .rollback; do rm_marked "$DIR/$d"; done
    rmdir "$DIR" 2>/dev/null || warn "$DIR still has other files; left in place"
  fi
  say "plugin data folders are kept; /config option values are removed"
  [ "$DRY" = 1 ] && say "dry run: nothing was changed"
  if [ "$FAILED" = 1 ]; then die "some steps failed (see the warnings above)"; fi
}
