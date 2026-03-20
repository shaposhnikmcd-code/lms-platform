import fs from 'fs';
import path from 'path';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const API_URL = 'https://api-free.deepl.com/v2/translate';

const LOCALES = [
  { code: 'pl', deepl: 'PL' },
  { code: 'en', deepl: 'EN-US' },
];

async function translate(text, targetLang) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang,
      source_lang: 'UK',
    }),
  });
  const data = await res.json();
  if (!data.translations) {
    console.error('DeepL error:', data);
    return text;
  }
  return data.translations[0].text;
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value, fullKey));
    }
  }
  return result;
}

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((cur, key) => cur?.[key], obj);
}

async function run() {
  const ukPath = path.resolve('messages/uk.json');
  const uk = JSON.parse(fs.readFileSync(ukPath, 'utf-8'));
  const flatUk = flattenObject(uk);

  for (const locale of LOCALES) {
    const localePath = path.resolve(`messages/${locale.code}.json`);
    const existing = JSON.parse(fs.readFileSync(localePath, 'utf-8'));

    const missing = [];
    for (const [key, value] of Object.entries(flatUk)) {
      const current = getNestedValue(existing, key);
      if (!current || current === value) {
        missing.push({ key, value });
      }
    }

    if (missing.length === 0) {
      console.log(`✓ ${locale.code}.json — все актуально`);
      continue;
    }

    console.log(`\n→ ${locale.code}.json — знайдено ${missing.length} ключів для перекладу`);

    for (const { key, value } of missing) {
      process.stdout.write(`  ${key} ... `);
      const translated = await translate(value, locale.deepl);
      setNestedValue(existing, key, translated);
      console.log(`✓`);
    }

    fs.writeFileSync(localePath, JSON.stringify(existing, null, 2), 'utf-8');
    console.log(`✓ ${locale.code}.json збережено`);
  }

  console.log('\n✅ Переклад завершено');
}

run().catch(console.error);