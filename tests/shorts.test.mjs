import test from 'node:test';import assert from 'node:assert/strict';import {validateSeries,demoCatalog} from '../src/shorts/catalog.js';
const valid=()=>({id:'a-series',title:'A series',genre:'Romance',free_episodes:1,episodes:[{number:1,title:'First',storage_path:'a-series/batch/1.mp4'}]});
test('valid catalogue metadata accepts a complete ordered series',()=>assert.equal(validateSeries(valid()).episode_count,1));
test('rejects unordered episodes',()=>{const s=valid();s.episodes[0].number=2;assert.throws(()=>validateSeries(s),/consecutive/)});
test('rejects a storage path outside its series',()=>{const s=valid();s.episodes[0].storage_path='other/1.mp4';assert.throws(()=>validateSeries(s),/paths/)});
test('rejects path traversal',()=>{const s=valid();s.episodes[0].storage_path='a-series/../1.mp4';assert.throws(()=>validateSeries(s),/paths/)});
test('rejects free count beyond available episodes',()=>assert.throws(()=>validateSeries({...valid(),free_episodes:3}),/exceeds/));
test('rejects unsafe poster protocol',()=>assert.throws(()=>validateSeries({...valid(),poster_url:'javascript:alert(1)'}),/HTTPS/));
test('concept sample does not contain fake video paths',()=>{assert.equal(demoCatalog[0].demo,true);assert.ok(demoCatalog[0].episodes.every(e=>!e.storage_path))});
