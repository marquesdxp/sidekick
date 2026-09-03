// Sends one timing job to the resident PowerShell worker, bypassing the panel.
// usage: node perf/job.mjs
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
const dir = process.env.APPDATA + '\\sidekick';
const base = `${dir}\\job_${Date.now()}`;
const out = `'${dir}\\job_out.png'`;
const src = [
  `${dir}\job_out.png`, // first line: the file, as $sk_path
  '$sw=[Diagnostics.Stopwatch]::StartNew()',
  '$d=[Windows.Forms.Clipboard]::GetDataObject(); $a=$sw.ElapsedMilliseconds',
  "$fm=($d.GetFormats() -join ', ')",
  '$s=$null; foreach($f in "PNG","image/png"){ if($s -eq $null -and $d.GetDataPresent($f)){ $s=$d.GetData($f) } }; $b=$sw.ElapsedMilliseconds',
  "$kind='none'",
  `if($s -is [IO.Stream]){ $fs=[IO.File]::Create(${out}); $s.Position=0; $s.CopyTo($fs); $fs.Close(); $kind='png-stream '+$s.Length }`,
  "elseif($s -ne $null){ $kind='png-'+$s.GetType().Name }",
  `else { $i=[Windows.Forms.Clipboard]::GetImage(); $c=$sw.ElapsedMilliseconds; $i.Save(${out},[System.Drawing.Imaging.ImageFormat]::Png); $kind='getimage '+($c-$b)+'ms save '+($sw.ElapsedMilliseconds-$c)+'ms' }`,
  '$out="getdataobject=$a getdata=$($b-$a) $kind total=$($sw.ElapsedMilliseconds) formats=$fm"',
  '#END',
].join('\n');
const t0 = performance.now();
writeFileSync(base + '.ps1', src);
while (!(existsSync(base + '.log') && readFileSync(base + '.log', 'utf8').trim())) { await new Promise((r) => setTimeout(r, 5)); }
const total = performance.now() - t0;
console.log(`round trip ${total.toFixed(0)} ms:`, readFileSync(base + '.log', 'utf8').replace(/^﻿/, '').trim());
unlinkSync(base + '.log');
