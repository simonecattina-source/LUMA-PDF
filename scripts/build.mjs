// Compilazione SOLO su GitHub/Vercel: le librerie OCR sono copiate nel sito.
// Nessun servizio remoto è chiamato dal browser per OCR o PDF.
import { readdir, readFile, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = process.cwd();
const dist = join(root, 'dist');
const modules = join(root, 'node_modules');
async function exists(file) {try{await readFile(file);return true;}catch{return false;}}
async function tree(folder) {
  const result=[];
  for(const item of await readdir(folder,{withFileTypes:true})) {
    const next=join(folder,item.name);
    if(item.isDirectory()) result.push(...await tree(next));
    else if(item.isFile()) result.push(next);
  }
  return result;
}
async function copy(src,dest) {await mkdir(dirname(dest),{recursive:true});await copyFile(src,dest);}
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of ['index.html','styles.css','app.js','merge-ui.js','pdf-merge-engine.js','a4-layout.js','ocr-ui.js','vercel.json']) await copy(join(root,file),join(dist,file));
for(const file of await tree(join(root,'assets'))) await copy(file,join(dist,'assets',file.slice(join(root,'assets').length+1)));
await copy(join(modules,'tesseract.js','dist','tesseract.min.js'),join(dist,'vendor','tesseract.min.js'));
await copy(join(modules,'tesseract.js','dist','worker.min.js'),join(dist,'vendor','worker.min.js'));
await copy(join(modules,'pdf-lib','dist','pdf-lib.min.js'),join(dist,'vendor','pdf-lib.min.js'));
const coreRoot=join(modules,'tesseract.js-core');
for(const file of await tree(coreRoot)) {
  const name=basename(file);
  if(/^tesseract-core(?:-simd)?(?:-lstm)?\.(?:wasm|wasm\.js|js)$/.test(name)) await copy(file,join(dist,'vendor','core',name));
}
for(const language of ['ita','eng']) {
  const langRoot=join(modules,'@tesseract.js-data',language);
  const candidates=(await tree(langRoot)).filter(f=>/\.traineddata(?:\.gz)?$/.test(f));
  if(!candidates.length)throw new Error('Modello OCR '+language+' non trovato nel pacchetto npm.');
  const preferred=candidates.find(f=>basename(f)===language+'.traineddata.gz') || candidates.find(f=>basename(f)===language+'.traineddata') || candidates[0];
  const content=await readFile(preferred);
  const compressed=extname(preferred)==='.gz'?content:gzipSync(content);
  const dest=join(dist,'vendor','lang',language+'.traineddata.gz');
  await mkdir(dirname(dest),{recursive:true});await writeFile(dest,compressed);
}
console.log('LUMA PDF: output dist/ pronto; OCR e PDF disponibili dal SOLO dominio del sito.');
