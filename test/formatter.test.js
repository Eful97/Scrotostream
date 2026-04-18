const assert = require('assert');
const { formatStream } = require('../src/formatter');

function run() {
  try {
    const s1 = { title: 'Video A', quality: '1080p', name: 'ProviderA' };
    const out1 = formatStream(s1, 'ProviderA');
    assert(out1, 'Output should exist');
    // Basic checks on emoji-based formatting
    assert.ok(typeof out1.qualityTag === 'string' && out1.qualityTag.startsWith('👌'));
    assert.ok(out1.name.startsWith('⚙️'));

    const s2 = { title: 'Video B', quality: '2160p', name: 'ProviderB' };
    const out2 = formatStream(s2, 'ProviderB');
    assert(out2, 'Output 2 should exist');
    assert.ok(out2.qualityTag.startsWith('🔥4K UHD'));

    console.log('formatter.test.js: OK');
  } catch (e) {
    console.error('formatter.test.js: FAIL', e && e.message ? e.message : e);
    process.exit(1);
  }
}

run();
