const assert=require('node:assert/strict'),V=require('../scanner/vision.js');
const veiled={inliers:36,ratio:.8,coverage:.31,referenceCoverage:.35,distance:.90,evidence:40};
assert.equal(V.decision([veiled]),'candidates','a geometrically verified colour veil remains a confirmation, never strong');
for(const weak of [{inliers:12},{ratio:.5},{coverage:.08},{referenceCoverage:.08}])assert.equal(V.decision([{...veiled,...weak}]),'reject','weak or localised geometry must not bypass colour rejection');
assert.equal(V.decision([veiled,{...veiled,evidence:35}]),'reject','ambiguous geometry must not bypass colour rejection');
assert.equal(V.decision([{...veiled,distance:.3}]),'strong','existing strong evidence retains its result');
console.log('PASS veiled-card confirmation, weak geometry rejection, rival rejection and unchanged strong-match threshold.');
