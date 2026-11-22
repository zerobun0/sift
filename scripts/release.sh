#!/usr/bin/env sh
# Makes a GitHub release: AMO-signed Firefox/Zen .xpi (self-updating) + Chrome zip (load unpacked).
# Needs ../.env.amo (WEB_EXT_API_KEY/SECRET) and gh logged in. Version comes from package.json.
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
echo "now: git commit updates.json, push, then gh release create v$V artifacts/sift-$V.xpi artifacts/sift-$V-chrome.zip"
