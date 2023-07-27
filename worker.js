
const framerate = 30
const frameEveryXSeconds = process.argv[4] || 30
const https = require('https')
const fs = require('fs');
var token = ''
const execSync = require('child_process').execSync;

const downloadFrame = (stamp, frame) => new Promise(resolve => {
    if (fs.existsSync("frames/" + stamp + '/' + frame.canvasIndex + '.png')) {
        resolve()
        return
    }
    const file = fs.createWriteStream("frames/" + stamp + '/' + frame.canvasIndex + '.png');
    const request = https.get(frame.url, function (response) {
        response.pipe(file);
        file.on("finish", () => {
            file.close();
            resolve()
        })
    });
})

downloadStamp = stamp => new Promise(resolve => {
    if (fs.existsSync('frames/' + stamp)) {
        resolve()
        return
    }
    console.log(`started download json of ${stamp}`)
    const data = {
        "operationName": "frameHistory",
        "variables": {
            "input": {
                "actionName": "get_frame_history",
                "GetFrameHistoryMessageData": {
                    "timestamp": stamp
                }
            }
        },
        "query": `mutation frameHistory($input: ActInput!) {
			act(input: $input) {
				data {
					... on BasicMessage {
						id
						data {
							... on GetFrameHistoryResponseMessageData {
								frames {
									canvasIndex
									url
									__typename
								}
								__typename
							}
							__typename
						}
						__typename
					}
					__typename
				}
				__typename
			}
		}`.replaceAll('\t', '')
    }
    const json = JSON.stringify(data)
    const request = https.request({
        hostname: 'gql-realtime-2.reddit.com',
        path: '/query',
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer ' + token,
            'content-length': json.length
        }
    }, res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data)
                if (parsed.success === false) {
                    console.log('ERROR DOWNLOADING JSON OF', stamp, data, 'If this is a unauthorized error, verify your token!')
                    fs.appendFileSync('errors.txt', stamp + '\n');
                }
            } catch (e) {
                console.log('ERROR PARSING JSON FROM', stamp, '. Some frames are broken, but if this happens to all, you might have to fix your token!')
            }
            fs.mkdirSync('frames/' + stamp)
            try {
                data = JSON.parse(data).data.act.data[0].data.frames
            } catch (e) {
                fs.appendFileSync('errors.txt', stamp + '\n');
                return resolve()
            }
            Promise.all(data.map(frame => downloadFrame(stamp, frame)))
                .then(() => resolve())
        })
    })
    request.write(json)
    request.end()
})

// Credits to Noah
async function getAccessToken() {
    const response = await fetch('https://reddit.com/r/place', {
        headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/116.0'
        }
    });
    const body = await response.text();

    // todo: yuck
    const configRaw = body.split('<script id="data">window.___r = ')[1].split(';</script>')[0];
    const config = JSON.parse(configRaw);

    return config.user.session.accessToken;
}

function getTodo() {
    let todo = []
    let starton = 1689858000000 + Number(process.argv[2]) || 0
    let endson = 1689858000000 + Number(process.argv[3]) || 0

    for (let stamp = starton; stamp <= endson + 1000; stamp += 1000 * frameEveryXSeconds) {
        todo.push(stamp)
    };
    todo = todo.reverse();
    return todo
}

async function main() {
    const stamps = getTodo()
    token = await getAccessToken()

    for (let [index, stamp] of stamps.entries()) {
        await downloadStamp(stamp)
    }
    for (let [index, stamp] of stamps.entries()) {
        for (let i = 0; i <= 5; i++) {
            if (!fs.existsSync(`frames/${stamp}/${i}.png`)) {
                fs.copyFileSync('frames/empty.png', `frames/${stamp}/${i}.png`)
            }
        }
    }
    for (let [index, stamp] of stamps.entries()) {
        console.log(`started merging frames of ${stamp}, ${stamps.length - index} remaining`)
        if (fs.existsSync(`combined/${stamp}.png`)) continue
        const output = execSync(`montage [0-7].png -tile 3x2 -geometry +0+0 ../../combined/${stamp}.png`, { encoding: 'utf-8', cwd: `frames/${stamp}` });
    }
}

main()

process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection at:', reason.stack || reason)
    // Recommended: send the information to sentry.io
    // or whatever crash reporting service you use
})

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
}
);