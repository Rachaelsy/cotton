require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const db = require('./database')
async function run() {
  const [rows] = await db.query('SELECT id, name, icon, image_url, category, price, unit, stock, status FROM products WHERE merchant_id=2')
  rows.forEach(p => console.log(JSON.stringify(p)))
  process.exit(0)
}
run().catch(e => { console.error(e.message); process.exit(1) })
