#!/bin/sh
# install.sh — install, update, roll back or remove the my-mods Claude Code plugins on Linux, macOS
# and WSL (POSIX sh; macOS bash 3.2 is fine). Spec: docs/release/RELEASE.md chapter 6.
#
#   sh install.sh                          install or update to the latest release (all 4 plugins)
#   sh install.sh --version v1.4.0         a given release
#   sh install.sh --plugins qhud,pinboard  only some plugins
#   sh install.sh --zip my-mods-v1.4.0.zip a zip you already have (needs SHA256SUMS.txt beside it,
#                                          or --sums <file>)
#   sh install.sh --dir <path>             install folder (default ${XDG_DATA_HOME:-~/.local/share}/claude-mods)
#   sh install.sh --rollback               go back to the previous install
#   sh install.sh --uninstall              remove the plugins, the marketplace and the install folder
#                                          (notes, pins and run logs in Claude's settings are kept)
#   sh install.sh --dry-run                print what would be done and change nothing
#
# Download order: gh (logged in) -> GITHUB_TOKEN (fine-grained, Contents: read-only) -> --zip.
# Run from an unzipped release (marketplace.json beside this script) it installs that bundle and
# downloads nothing. macOS: if the script is blocked, run `xattr -d com.apple.quarantine install.sh`.

REPO="gloriouslegacy/claude-mods"
MARKET="my-mods"
ALL_PLUGINS="qhud change-tutor pinboard agent-flow"
RETIRED="blast-radius replay-theater"
MIN_CLAUDE="2.1.287"

say() { printf '%s\n' "install: $*"; }
warn() { printf '%s\n' "install: warning: $*" >&2; }
die() { printf '%s\n' "install: error: $*" >&2; exit 1; }
usage() { sed -n '2,19s/^# \{0,1\}//p' "$0"; }

MODE=install DRY=0 VERSION_ARG="" PLUGINS_ARG="" ZIP="" SUMS="" DIR=""
while [ $# -gt 0 ]; do
  case $1 in
    --version|--plugins|--zip|--sums|--dir)
      if [ $# -lt 2 ] || [ -z "$2" ]; then die "$1 needs a value"; fi
      case $1 in
        --version) VERSION_ARG=$2 ;;
        --plugins) PLUGINS_ARG=$2 ;;
        --zip) ZIP=$2 ;;
        --sums) SUMS=$2 ;;
        --dir) DIR=$2 ;;
      esac
      shift 2 ;;
    --rollback) [ "$MODE" != uninstall ] || die "--rollback and --uninstall cannot be used together"; MODE=rollback; shift ;;
    --uninstall) [ "$MODE" != rollback ] || die "--rollback and --uninstall cannot be used together"; MODE=uninstall; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option $1 (see --help)" ;;
  esac
done

if [ "$MODE" != install ] && [ -n "$ZIP$VERSION_ARG$SUMS" ]; then die "--zip, --version and --sums only apply to an install"; fi
if [ "$MODE" = uninstall ] && [ -n "$PLUGINS_ARG" ]; then
  die "--uninstall removes every $MARKET plugin; to remove one use: claude plugin uninstall <name>@$MARKET"
fi
[ -z "$SUMS" ] || [ -n "$ZIP" ] || die "--sums needs --zip"
if [ -n "$VERSION_ARG" ]; then
  case $VERSION_ARG in *[!0-9A-Za-z.-]*) die "--version must look like v1.4.0, got '$VERSION_ARG'" ;; esac
  printf '%s\n' "$VERSION_ARG" | grep -Eq '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$' ||
    die "--version must look like v1.4.0, got '$VERSION_ARG'"
fi
case $VERSION_ARG in ""|v*) ;; *) VERSION_ARG="v$VERSION_ARG" ;; esac

# ---- install folder: absolute, never / or $HOME itself; only current/ and previous/ live in it ----
[ -n "$DIR" ] || DIR="${XDG_DATA_HOME:-$HOME/.local/share}/claude-mods"
case $DIR in /*) ;; *) DIR="$(pwd)/$DIR" ;; esac
while :; do case $DIR in */) DIR=${DIR%/} ;; *) break ;; esac; done
case $DIR in
  ""|"$HOME"|*/..|*/../*|*/.|*/./*) die "refusing install folder '$DIR'" ;;
esac
[ "$DIR" != "${HOME%/}" ] || die "refusing install folder '$DIR'"
if [ -d "$DIR" ]; then # also through symlinks
  real=$(cd "$DIR" && pwd -P) || die "cannot open install folder '$DIR'"
  hreal=$(cd "$HOME" 2>/dev/null && pwd -P)
  if [ "$real" = / ] || [ "$real" = "$hreal" ]; then die "refusing install folder '$DIR' (it is / or your home folder)"; fi
fi

# current/ and previous/ are replaced or deleted only when they hold a my-mods bundle.
is_bundle() { [ -f "$1/.claude-plugin/marketplace.json" ]; }
guard_slots() {
  for s in current previous; do
    if [ -e "$DIR/$s" ] && ! is_bundle "$DIR/$s"; then
      die "$DIR/$s is not a my-mods install (no .claude-plugin/marketplace.json); not touching it. Pick another --dir"
    fi
  done
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

# ---- temp folder (downloads and unpacking only) ----
TMP=""
cleanup() {
  case $TMP in */my-mods-install.??????) rm -rf -- "$TMP" ;; esac
}
trap cleanup EXIT
trap 'exit 130' INT TERM
TMP=$(mktemp -d "${TMPDIR:-/tmp}/my-mods-install.XXXXXX") || die "cannot create a temp folder"

# ---- step 1: tools and Claude Code ----
have() { command -v "$1" >/dev/null 2>&1; }

need() { # need <what> <hint>: stops a real run, warns in a dry run
  if [ "$DRY" = 1 ]; then warn "$1; a real run stops here. $2"; else die "$1. $2"; fi
}

version_ge() { # version_ge 2.1.300 2.1.287
  awk -v a="$1" -v b="$2" 'BEGIN { split(a, x, "."); split(b, y, ".");
    for (i = 1; i <= 3; i++) { p = x[i] + 0; q = y[i] + 0; if (p > q) exit 0; if (p < q) exit 1 } exit 0 }'
}

HAVE_CLAUDE=0
check_claude() {
  if ! have claude; then
    need "the claude CLI is not on PATH" "Install Claude Code $MIN_CLAUDE or later first."
    return 0
  fi
  cv=$(claude --version 2>/dev/null | awk '{ print $1; exit }')
  if version_ge "$cv" "$MIN_CLAUDE"; then
    HAVE_CLAUDE=1; say "Claude Code $cv"
  else
    need "Claude Code ${cv:-unknown} is older than $MIN_CLAUDE" "Update Claude Code (claude update)."
  fi
}

check_platform() {
  if [ -r /proc/version ] && grep -qi microsoft /proc/version; then
    say "WSL: Claude Code here has its own ~/.claude, separate from Windows; install in each environment you use."
    case $DIR in /mnt/*) warn "install folder $DIR is on the Windows drive; keep it on the Linux side (slow, permission trouble)" ;; esac
  fi
}

sha256_of() {
  if have sha256sum; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{ print tolower($1) }'
}

need_unpack_tools() {
  have unzip || need "unzip is missing" "Install it (apt install unzip / dnf install unzip)."
  have sha256sum || have shasum || need "sha256sum (or shasum) is missing" "Install coreutils."
}

# ---- step 2: get the release ----
# GitHub API with GITHUB_TOKEN. The token goes through stdin (curl) or a private wgetrc (wget),
# never on a command line or in output.
api_get() { # api_get <url> <out> <accept>
  if have curl; then
    if [ "$3" = "application/octet-stream" ]; then
      # Assets redirect to storage that rejects the token: resolve the redirect, then fetch without it.
      loc=$(printf 'header = "Authorization: Bearer %s"\n' "$GITHUB_TOKEN" |
        curl -fsS -K - -H "Accept: $3" -H "X-GitHub-Api-Version: 2022-11-28" -o /dev/null -w '%{redirect_url}' "$1") ||
        return 1
      if [ -n "$loc" ]; then curl -fsSL -o "$2" "$loc"; else # 200 without a redirect: fetch it with the token
        printf 'header = "Authorization: Bearer %s"\n' "$GITHUB_TOKEN" | curl -fsSL -K - -H "Accept: $3" -H "X-GitHub-Api-Version: 2022-11-28" -o "$2" "$1"; fi
    else
      printf 'header = "Authorization: Bearer %s"\n' "$GITHUB_TOKEN" |
        curl -fsSL -K - -H "Accept: $3" -H "X-GitHub-Api-Version: 2022-11-28" -o "$2" "$1"
    fi
  else
    rc="$TMP/wgetrc"
    (umask 077 && printf 'header = Authorization: Bearer %s\n' "$GITHUB_TOKEN" > "$rc") || return 1
    if [ "$3" = "application/octet-stream" ]; then
      # Assets redirect to storage that rejects the token: resolve the redirect, then fetch without it.
      loc=$(WGETRC="$rc" wget -q -S --max-redirect=0 --header="Accept: $3" -O /dev/null "$1" 2>&1 |
        tr -d '\r' | awk '/^ *Location: / { u = $2 } END { print u }')
      if [ -n "$loc" ]; then rm -f "$rc"; WGETRC=/dev/null wget -q -O "$2" "$loc"; else # 200 without a redirect
        WGETRC="$rc" wget -q --header="Accept: $3" -O "$2" "$1"; st=$?; rm -f "$rc"; return "$st"; fi
    else
      WGETRC="$rc" wget -q --header="Accept: $3" -O "$2" "$1"; st=$?
      rm -f "$rc"; return "$st"
    fi
  fi
}

# Prints "<name> <api url>" for each asset of a release JSON.
release_assets() {
  tr ',{}' '\n\n\n' < "$1" | awk '
    /"url"[ \t]*:[ \t]*"[^"]*\/releases\/assets\/[0-9]+"/ { u = $0; sub(/^[^"]*"url"[ \t]*:[ \t]*"/, "", u); sub(/".*/, "", u); next }
    u != "" && /"name"[ \t]*:/ { n = $0; sub(/^[^"]*"name"[ \t]*:[ \t]*"/, "", n); sub(/".*/, "", n); print n " " u; u = "" }'
}

release_tag() {
  tr ',' '\n' < "$1" | sed -n 's/^[[:space:]{]*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

gh_ready() { have gh && gh auth status --hostname github.com >/dev/null 2>&1; }

LATEST_TAG=""
download() { # sets ZIP and SUMS
  dl="$TMP/dl"; mkdir -p "$dl" || die "cannot create $dl"
  want=${VERSION_ARG:-latest}
  if gh_ready; then
    say "downloading $want with gh"
    if [ -n "$VERSION_ARG" ]; then
      gh release download "$VERSION_ARG" --repo "$REPO" --pattern 'my-mods-*.zip' --pattern SHA256SUMS.txt --dir "$dl"
    else
      gh release download --repo "$REPO" --pattern 'my-mods-*.zip' --pattern SHA256SUMS.txt --dir "$dl"
    fi || die "gh release download failed (repo=$REPO version=$want)"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    have curl || have wget || die "curl (or wget) is missing. Install curl."
    say "downloading $want with GITHUB_TOKEN"
    if [ -n "$VERSION_ARG" ]; then api="https://api.github.com/repos/$REPO/releases/tags/$VERSION_ARG"
    else api="https://api.github.com/repos/$REPO/releases/latest"; fi
    api_get "$api" "$TMP/release.json" "application/vnd.github+json" ||
      die "cannot read release $want (check the token: this repo, Contents read-only, not expired)"
    [ -n "$VERSION_ARG" ] || LATEST_TAG=$(release_tag "$TMP/release.json")
    release_assets "$TMP/release.json" > "$TMP/assets.txt"
    while read -r an au; do
      case $an in my-mods-*.zip|SHA256SUMS.txt)
        api_get "$au" "$dl/$an" "application/octet-stream" || die "download failed: $an" ;;
      esac
    done < "$TMP/assets.txt"
  else
    die "no way to download: log in with gh (gh auth login), set GITHUB_TOKEN, or pass --zip <file> (see README)"
  fi
  for f in "$dl"/my-mods-*.zip; do [ -f "$f" ] && ZIP=$f; done
  [ -n "$ZIP" ] || die "the release has no my-mods-*.zip"
  if [ -z "$VERSION_ARG" ]; then zn=$(basename "$ZIP" .zip); LATEST_TAG=${zn#my-mods-}; fi
  SUMS="$dl/SHA256SUMS.txt"
  [ -f "$SUMS" ] || die "the release has no SHA256SUMS.txt"
}

# ---- step 3: verify ----
verify() { # verify <zip> <sums>
  vn=$(basename "$1")
  vw=$(tr -d '\r' < "$2" | awk -v n="$vn" '{ f = $2; sub(/^\*/, "", f); if (f == n) { print tolower($1); exit } }')
  [ -n "$vw" ] || die "$2 has no line for $vn (keep the zip's release name)"
  vg=$(sha256_of "$1")
  [ "$vg" = "$vw" ] || die "checksum mismatch for $vn: expected $vw, got $vg. Download it again."
  say "checksum ok: $vn"
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

selected_plugins() {
  sel=$(printf '%s' "${PLUGINS_ARG:-$ALL_PLUGINS}" | tr ',' ' ')
  for p in $sel; do
    case " $ALL_PLUGINS " in *" $p "*) ;; *) die "unknown plugin '$p' (choose from: $ALL_PLUGINS)" ;; esac
  done
  printf '%s\n' "$sel"
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
BUNDLE="" BUNDLE_VERSION=""
do_install() {
  PLUGINS=$(selected_plugins) || exit 1
  SCRIPT_DIR=""
  # Piped in (curl ... | sh) $0 is the shell, not this file: there is no bundle beside it.
  if [ -f "$0" ] && grep -q 'my-mods Claude Code plugins' "$0" 2>/dev/null; then
    SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
  fi
  if [ -z "$ZIP" ] && [ -z "$VERSION_ARG" ] && [ -n "$SCRIPT_DIR" ] && is_bundle "$SCRIPT_DIR"; then
    BUNDLE=$SCRIPT_DIR
    say "installing the bundle beside this script ($BUNDLE); nothing to download"
    say "bundle next to the script: checksum not checked"
  else
    if [ -n "$ZIP" ]; then
      [ -f "$ZIP" ] || die "no such zip: $ZIP"
      [ -n "$SUMS" ] || SUMS="$(dirname -- "$ZIP")/SHA256SUMS.txt"
      [ -f "$SUMS" ] || die "$SUMS not found: put SHA256SUMS.txt from the same release beside the zip, or pass --sums <file>"
    elif [ "$DRY" = 1 ]; then
      if have gh; then how="gh (needs gh auth login)"
      elif [ -n "${GITHUB_TOKEN:-}" ]; then how="GITHUB_TOKEN"
      else how="nothing available: a real run needs gh, GITHUB_TOKEN or --zip"; fi
      say "would download ${VERSION_ARG:-the latest release} of $REPO via $how, then check SHA256SUMS.txt and unpack it"
    else
      download
    fi
    if [ -n "$ZIP" ]; then
      need_unpack_tools
      if have unzip && { have sha256sum || have shasum; }; then
        verify "$ZIP" "$SUMS"
        unzip -q "$ZIP" -d "$TMP/x" || die "cannot unpack $ZIP"
        [ -f "$TMP/x/my-mods/.claude-plugin/marketplace.json" ] ||
          die "$ZIP is not a my-mods release (no my-mods/.claude-plugin/marketplace.json)"
        BUNDLE="$TMP/x/my-mods"
      fi
    fi
  fi
  if [ -n "$BUNDLE" ]; then
    if [ -f "$BUNDLE/VERSION" ]; then BUNDLE_VERSION=$(tr -d ' \t\r\n' < "$BUNDLE/VERSION"); fi
    say "bundle version v${BUNDLE_VERSION:-unknown}"
    for p in $PLUGINS; do
      grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$p\"" "$BUNDLE/.claude-plugin/marketplace.json" ||
        die "this bundle has no plugin '$p'"
    done
    swap_in "$BUNDLE"
  else
    say "would move $DIR/current to previous/ and put the new version in $DIR/current"
  fi
  register
  install_plugins "$PLUGINS"
  finish
}

do_rollback() {
  PLUGINS=$(selected_plugins) || exit 1
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

do_uninstall() {
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

[ "$DRY" = 1 ] && say "dry run: nothing will be changed"
say "mode=$MODE dir=$DIR"
recover_swap
guard_slots
check_claude
check_platform
case $MODE in
  install) do_install ;;
  rollback) do_rollback ;;
  uninstall) do_uninstall ;;
esac
exit 0
