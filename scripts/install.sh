#!/bin/sh
# install.sh — install, update, roll back or remove the my-mods Claude Code plugins on Linux, macOS
# and WSL (POSIX sh; macOS bash 3.2 is fine). Spec: docs/release/RELEASE.md chapter 6.
#
#   sh install.sh                          install or update to the latest release (all 4 plugins)
#   sh install.sh --version v1.4.0         a given release
#   sh install.sh --plugins qhud,pinboard  only some plugins
#   sh install.sh --zip my-mods-v1.4.0.zip a zip you already have (needs SHA256SUMS.txt beside it,
#                                          or --sums <file>)
#   sh install.sh --dir <path>             install folder (default ${CLAUDE_CONFIG_DIR:-~/.claude}/claude-mods)
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
# RETIRED is read by install-lib.sh
# shellcheck disable=SC2034
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

# ---- install folder: absolute, never /, $HOME or Claude's config folder itself; only current/ and previous/ live in it ----
CFG=${CLAUDE_CONFIG_DIR:-$HOME/.claude}
while :; do case $CFG in ?*/) CFG=${CFG%/} ;; *) break ;; esac; done
[ -n "$DIR" ] || DIR="$CFG/claude-mods"
case $DIR in /*) ;; *) DIR="$(pwd)/$DIR" ;; esac
while :; do case $DIR in */) DIR=${DIR%/} ;; *) break ;; esac; done
case $DIR in
  ""|"$HOME"|*/..|*/../*|*/.|*/./*) die "refusing install folder '$DIR'" ;;
esac
[ "$DIR" != "${HOME%/}" ] && [ "$DIR" != "$CFG" ] || die "refusing install folder '$DIR'"
if [ -d "$DIR" ]; then # also through symlinks
  real=$(cd "$DIR" && pwd -P) || die "cannot open install folder '$DIR'"
  hreal=$(cd "$HOME" 2>/dev/null && pwd -P)
  creal=$(cd "$CFG" 2>/dev/null && pwd -P)
  if [ "$real" = / ] || [ "$real" = "$hreal" ] || [ "$real" = "$creal" ]; then
    die "refusing install folder '$DIR' (it is /, your home folder or Claude's config folder)"
  fi
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

# HAVE_CLAUDE is read by install-lib.sh
# shellcheck disable=SC2034
HAVE_CLAUDE=0
# shellcheck disable=SC2034
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

# LATEST_TAG is read by install-lib.sh
# shellcheck disable=SC2034
LATEST_TAG=""
# shellcheck disable=SC2034
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

selected_plugins() {
  sel=$(printf '%s' "${PLUGINS_ARG:-$ALL_PLUGINS}" | tr ',' ' ')
  for p in $sel; do
    case " $ALL_PLUGINS " in *" $p "*) ;; *) die "unknown plugin '$p' (choose from: $ALL_PLUGINS)" ;; esac
  done
  printf '%s\n' "$sel"
}

# ---- step 4: get the bundle (beside this script, --zip, or download + checksum) ----
BUNDLE="" BUNDLE_VERSION="" SCRIPT_DIR=""
# Piped in (curl ... | sh) $0 is the shell, not this file: there is no bundle or lib beside it.
if [ -f "$0" ] && grep -q 'my-mods Claude Code plugins' "$0" 2>/dev/null; then
  SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
fi

acquire_bundle() { # sets BUNDLE (empty only in a dry run) and BUNDLE_VERSION
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
  fi
}

# ---- step 5 on: install-lib.sh (swap, marketplace, plugins, rollback, uninstall, summary) ----
# Looked up in: the bundle just obtained (install) -> beside this script -> $DIR/current -> $DIR/previous.
# Contract (what this file hands over, what the lib provides) is at the top of install-lib.sh.
LIB="" LIB_LOOKED=""
try_lib() {
  LIB_LOOKED="${LIB_LOOKED:+$LIB_LOOKED, }$1"
  if [ -z "$LIB" ] && [ -f "$1/install-lib.sh" ]; then LIB="$1/install-lib.sh"; fi
}
load_lib() {
  if [ "$MODE" = install ] && [ -n "$BUNDLE" ]; then try_lib "$BUNDLE"; fi
  if [ -n "$SCRIPT_DIR" ]; then try_lib "$SCRIPT_DIR"; fi
  try_lib "$DIR/current"
  try_lib "$DIR/previous"
  [ -n "$LIB" ] || die "install-lib.sh not found (looked in: $LIB_LOOKED). Run install.sh from an unzipped release, or pass --zip <file>"
  # shellcheck source=/dev/null
  . "$LIB"
  command -v lib_mode_install >/dev/null 2>&1 || die "$LIB is not a usable install-lib.sh"
}

[ "$DRY" = 1 ] && say "dry run: nothing will be changed"
say "mode=$MODE dir=$DIR"
guard_slots
check_claude
check_platform
case $MODE in install|rollback) PLUGINS=$(selected_plugins) || exit 1 ;; *) PLUGINS="" ;; esac
if [ "$MODE" = install ]; then acquire_bundle; fi
load_lib
case $MODE in
  install) lib_mode_install ;;
  rollback) lib_mode_rollback ;;
  uninstall) lib_mode_uninstall ;;
esac
exit 0
