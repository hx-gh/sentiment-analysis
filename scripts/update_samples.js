const fs = require('fs');
const path = require('path');

const updateAttributes = (filePath) => {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${fullPath}`);
        return;
    }

    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const now = new Date();

    // Update messages to be within the last few minutes
    content.messages.forEach((msg, index) => {
        // Stagger timestamps slightly backwards from now, max 10 mins
        const offset = index % 10;
        const msgTime = new Date(now.getTime() - offset * 60000);
        msg.timestamp = msgTime.toISOString();
    });

    fs.writeFileSync(fullPath, JSON.stringify(content, null, 4));
    console.log(`Updated timestamps in ${filePath}`);
};

updateAttributes('examples/sample-request.json');
updateAttributes('examples/edge-cases.json');
updateAttributes('examples/performance-1k.json');
console.log('All sample files updated with current timestamps.');
