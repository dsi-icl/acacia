const path = require('path');
const fs = require('fs');
const os2 = require('os2');

if (process.argv.length !== 7) {
    // eslint-disable-next-line no-console
    console.log(`usage: ${process.argv[1]} <objectstorage_url> <user> <key> <container> <file_or_directory>`);
    process.exit(1);
}

try{
    const filedirname = process.argv[6];

    let files;
    const stats = fs.lstatSync(filedirname);
    if(stats.isDirectory()) {
        files = fs.readdirSync(filedirname).map(f=>`${filedirname}/${f}`);
    } else {
        files = [filedirname];
    }

    (async () => {
        const store = new os2.Store(process.argv[2]);
        const account = new os2.Account(store, process.argv[3], process.argv[4]);
        await account.connect();
        const container = new os2.Container(account, process.argv[5]);
        await container.create();

        for(let i = 0;i < files.length;i++) {
            let object = new os2.Segment(container, path.basename(files[i]));
            await object.createFromDisk(files[i]);
            await object.setMetadata({ test: files[i] }); // Temporal test...
        }

    })();
} catch(error){ console.error(error.toString()); }