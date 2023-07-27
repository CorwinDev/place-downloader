const frameEveryXSeconds = 30
const { spawn } = require("node:child_process");
const fs = require('fs');

function getTodo() {
    let todo = []
    for (let stamp = 1689858000000; stamp <= 1690320892999 + 1000; stamp += 1000 * frameEveryXSeconds) {
        todo.push(stamp)
    };
    todo = todo.reverse();
    return todo
}

if (!fs.existsSync('frames')) fs.mkdirSync('frames');
if (!fs.existsSync('combined')) fs.mkdirSync('combined');
(async () => {
    const stamps = getTodo()
    const total = 1690320892999 - 1689858000000
    const threads = process.argv[2] || 4
    const stampsPerThread = Math.ceil(total / threads)
    
    const threadsActive = []
    
    for (let i = 0; i < threads; i++) {
        const start = i * stampsPerThread
        const end = Math.min((i + 1) * stampsPerThread, total)

        // Round it to the nearest second
        const startStamp = Math.floor(start / 1000) * 1000
        const endStamp = Math.floor(end / 1000) * 1000

        console.log(`started thread ${i} with ${endStamp - startStamp} stamps`)
      
        const thread = await spawn('node', ['worker.js', startStamp, endStamp, frameEveryXSeconds])
        threadsActive.push(thread)
        thread.on('exit', (data) => {
            threadsActive.splice(threadsActive.indexOf(thread), 1)
            console.log('thread exited', data)
            console.log('thread exited')
        })
        thread.stdout.on('data', data => {
            console.log('thread stdout:', data.toString())
        })
    }
    console.log('waiting for threads to finish...')
    while (threadsActive.length == 0) {

        for (let [index, stamp] of stamps.entries()) {
            console.log(`started copying ${stamp}, ${stamps.length - index} remaining`)
            if (fs.existsSync(`tovideo/${stamp}.png`)) continue
            fs.copyFileSync(`combined/${stamp}.png`, `tovideo/${stamp}.png`)
        }
        console.log('started ffmpeg...')
        execSync(`ffmpeg -r ${framerate} -framerate ${framerate} -pattern_type glob -i '*.png' -c:v libx264 -pix_fmt yuv420p ${frameEveryXSeconds}min-${framerate}fps.mp4`, { cwd: 'combined' })
        console.log('done')
    }

}
)()
