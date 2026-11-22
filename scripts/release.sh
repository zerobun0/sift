#!/usr/bin/env sh
# Makes a GitHub release: AMO-signed Firefox/Zen .xpi (self-updating) + Chrome zip (load unpacked).
# Write CHANGES first (the "What's new" lines). Needs ../.env.amo (WEB_EXT_API_KEY/SECRET) and gh logged in. Version comes from package.json.
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./package.json').version")
set -a; . ../.env.amo; set +a
SIFT_SELF=1 npm run build
npx web-ext sign --channel unlisted --source-dir dist/firefox --artifacts-dir artifacts || true
until [ -f "artifacts/sift-$V.xpi" ]; do node scripts/fetch-signed.mjs "artifacts/sift-$V.xpi" | tail -1; [ -f "artifacts/sift-$V.xpi" ] || sleep 30; done
python -c "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', 'dist/chrome')" "artifacts/sift-$V-chrome"
node -e "
const v='$V',fs=require('fs');const f='updates.json';const u=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{addons:{'sift@zerobun.com':{updates:[]}}};
const list=u.addons['sift@zerobun.com'].updates.filter(x=>x.version!==v);
list.push({version:v,update_link:'https://github.com/zerobun0/sift/releases/download/v'+v+'/sift-'+v+'.xpi'});
u.addons['sift@zerobun.com'].updates=list;fs.writeFileSync(f,JSON.stringify(u,null,2)+'\n');"
# Release notes always carry install steps for both browsers. Changes come from CHANGES (one "- line" per change).
[ -f CHANGES ] || { echo "write CHANGES (what's new, as '- ' lines) first"; exit 1; }
V="$V" node -e "const fs=require('fs');fs.writeFileSync('artifacts/notes.md',fs.readFileSync('scripts/release-notes.md','utf8').replaceAll('{{V}}',process.env.V).replace('{{CHANGES}}',fs.readFileSync('CHANGES','utf8').trim()))"
git add updates.json && git commit -qm "updates.json: $V" && git push -q
gh release create "v$V" "artifacts/sift-$V.xpi" "artifacts/sift-$V-chrome.zip" --title "Sift $V" --notes-file artifacts/notes.md
rm CHANGES
