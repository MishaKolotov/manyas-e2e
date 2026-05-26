import * as xlsx from 'xlsx';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wb = xlsx.utils.book_new();

const sheet1Data = [
  ['key', 'en', 'ru', 'fr', 'de', 'it', 'pt', 'es', 'zh', 'ja', 'ko'],
  ['intro_text_0', 'Walking', 'Ходьба', 'Marche', 'Gehen', 'Camminando', 'Caminhando', 'Caminando', '步行', 'ウォーキング', '걷는'],
  ['intro_text_1', 'Lose weight', 'Похудеть', 'Perdre du poids', 'Abnehmen', 'Perdere peso', 'Perder peso', 'Bajar de peso', '减肥', '減量', '체중감량'],
  ['ВАЖНАЯ ИНФОРМАЦИЯ !!!!', '', '', '', '', '', '', '', '', '', ''],
  ['', 'orphan en value', '', '', '', '', '', '', '', '', ''],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sheet1Data), 'Sheet1');

const sheet2Data = [
  ['English', 'Russian', 'French', 'German', 'Italian', 'Portuguese', 'Spanish', 'Chinese', 'Japanese', 'Korean'],
  ['What do you want?', 'Чего вы хотите?', 'Que voulez-vous?', 'Was möchten Sie?', 'Cosa vuoi?', 'O que você quer?', '¿Qué quieres?', '您想要什么？', '何が欲しいですか？', '무엇을 원하세요?'],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sheet2Data), 'Sheet2');

const sheet3Data = [
  ['key', 'en', 'ru', 'fr', 'de', 'it', 'pt', 'es', 'zh', 'ja', 'ko'],
  ['paywall_title', 'Get started', 'Начать', 'Commencer', 'Loslegen', 'Inizia', 'Começar', 'Empezar', '开始', '始める', '시작'],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sheet3Data), 'Sheet3');

const out = path.join(__dirname, '__importer-test-input.xlsx');
xlsx.writeFile(wb, out);
console.log('Wrote', out);
