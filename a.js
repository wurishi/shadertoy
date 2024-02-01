const fs = require('fs');
const path = require('path');

let total = 0;
let succ = 0;
fs.readdir(path.join(__dirname, 'subs'), (err, files) => {
  files.forEach((f) => {
    const file = path.join(__dirname, 'subs', f);
    fs.readFile(file, 'utf-8', (err, fc) => {
      let index = fc.indexOf('sort() {');
      if (index >= 0) {
        index = fc.indexOf('return ', index);
        if (index > 0) {
          const li = fc.indexOf(';', index);
          let sort = +fc.substring(index + 7, li);
          if (sort > 200 && sort <= 300) {
            total++;
            fs.copyFile(file, path.join(__dirname, 'subs2', f), (err, res) => {
              if (!err) {
                succ++;
                console.log(total, succ);
                fs.unlink(file, () => {});
              } else {
                console.log(err);
              }
            });
          }
        }
      }
    });
  });
});
