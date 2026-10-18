import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeVoiceSegments} from '../../src/services/voiceTranscript';

test('resultados repetidos e prefixos reenviados não duplicam a descrição',()=>{
 assert.equal(mergeVoiceSegments(['luz','luz','luz','vence hoje']),'luz vence hoje');
 assert.equal(mergeVoiceSegments(['despesa luz 300 reais','luz 300 reais dia 10/11/2026']),'despesa luz 300 reais dia 10/11/2026');
 assert.equal(mergeVoiceSegments(['despesa luz 300 reais','despesa luz 300 reais vence hoje']),'despesa luz 300 reais vence hoje');
 assert.equal(mergeVoiceSegments(['Conta de luz.','LUZ vence hoje']),'Conta de luz. vence hoje');
});
test('repetições dentro da fala e informações diferentes são preservadas',()=>{
 assert.equal(mergeVoiceSegments(['muito muito importante','pagar 50 reais','receber 50 reais']),'muito muito importante pagar 50 reais receber 50 reais');
});
