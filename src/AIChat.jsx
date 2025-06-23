[10:38:29.118] Running build in Washington, D.C., USA (East) – iad1
[10:38:29.118] Build machine configuration: 2 cores, 8 GB
[10:38:29.132] Cloning github.com/1droxion/droxion-live-final (Branch: main, Commit: fe26a9d)
[10:38:57.202] Warning: Failed to fetch one or more git submodules
[10:38:57.203] Cloning completed: 28.071s
[10:38:58.176] Found .vercelignore
[10:38:58.986] Removed 11568 ignored files defined in .vercelignore
[10:38:58.987]   /node_modules/.bin/browserslist
[10:38:58.987]   /node_modules/.bin/browserslist.cmd
[10:38:58.987]   /node_modules/.bin/browserslist.ps1
[10:38:58.987]   /node_modules/.bin/esbuild
[10:38:58.987]   /node_modules/.bin/esbuild.cmd
[10:38:58.987]   /node_modules/.bin/esbuild.ps1
[10:38:58.987]   /node_modules/.bin/jsesc
[10:38:58.987]   /node_modules/.bin/jsesc.cmd
[10:38:58.987]   /node_modules/.bin/jsesc.ps1
[10:38:58.987]   /node_modules/.bin/json5
[10:38:59.372] Restored build cache from previous deployment (8cRaQvcqNyowZDdXJhVdpPjsTkkg)
[10:38:59.984] Running "vercel build"
[10:39:00.421] Vercel CLI 43.3.0
[10:39:00.960] Installing dependencies...
[10:39:42.483] npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead
[10:39:43.536] npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
[10:39:44.214] npm warn deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
[10:39:48.167] 
[10:39:48.168] changed 733 packages in 47s
[10:39:48.169] 
[10:39:48.169] 315 packages are looking for funding
[10:39:48.169]   run `npm fund` for details
[10:39:48.591] [36mvite v4.5.14 [32mbuilding for production...[36m[39m
[10:39:48.820] transforming...
[10:39:48.983] [32m✓[39m 19 modules transformed.
[10:39:48.984] [31m[vite-plugin-pwa:build] Transform failed with 1 error:
[10:39:48.985] /vercel/path0/src/AIChat.jsx:91:25: ERROR: Syntax error "\"[39m
[10:39:48.985] file: [36m/vercel/path0/src/AIChat.jsx:91:25[39m
[10:39:48.985] [33m
[10:39:48.985] [33mSyntax error "\"[33m
[10:39:48.985] 89 |          formatted = reply;
[10:39:48.985] 90 |        } else if (/box|highlight/.test(lower)) {
[10:39:48.985] 91 |          formatted = `\\`\\`\\`\n${reply}\n\\`\\`\\``;
[10:39:48.985]    |                           ^
[10:39:48.985] 92 |        }
[10:39:48.986] 93 |  
[10:39:48.986] [39m
[10:39:48.986] [31merror during build:
[10:39:48.986] Error: Transform failed with 1 error:
[10:39:48.986] /vercel/path0/src/AIChat.jsx:91:25: ERROR: Syntax error "\"
[10:39:48.986]     at failureErrorWithLog (/vercel/path0/node_modules/esbuild/lib/main.js:1649:15)
[10:39:48.986]     at /vercel/path0/node_modules/esbuild/lib/main.js:847:29
[10:39:48.986]     at responseCallbacks.<computed> (/vercel/path0/node_modules/esbuild/lib/main.js:703:9)
[10:39:48.986]     at handleIncomingPacket (/vercel/path0/node_modules/esbuild/lib/main.js:762:9)
[10:39:48.987]     at Socket.readFromStdout (/vercel/path0/node_modules/esbuild/lib/main.js:679:7)
[10:39:48.987]     at Socket.emit (node:events:518:28)
[10:39:48.987]     at addChunk (node:internal/streams/readable:561:12)
[10:39:48.987]     at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
[10:39:48.987]     at Readable.push (node:internal/streams/readable:392:5)
[10:39:48.987]     at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)[39m
[10:39:48.998] Error: Command "vite build" exited with 1
[10:39:49.306] 
[10:39:52.104] Exiting build container
