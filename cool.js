const { readFile, writeFile } = require('fs').promises
const { join } = require('path')
const https = require('https')

const args = process.argv.slice(2)

main(...args)

async function main(repo, token, usersPerRow, templatePath) {
  try {
    const coolPeople = await getCoolPeople(repo, token)
    const template = await loadTemplate(templatePath)
    const table = createTable(coolPeople, usersPerRow)
    const regex = /(?<=<!--START_SECTION:cool-people-->)[\s\S]*(?=<!--END_SECTION:cool-people-->)/
    const readme = template.replace(regex, table)
    await saveREADME(readme)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

async function loadTemplate(path = 'TEMPLATE.md') {
  const templatePath = join(process.cwd(), path)
  return await readFile(templatePath, 'utf-8')
}

async function saveREADME(content) {
  const path = join(process.cwd(), 'README.md')
  await writeFile(path, content)
}

function createTable(users, usersPerRow) {
  const numberOfRows = Math.ceil(users.length / usersPerRow)
  const usersHTML = users.map(user => `
  <td align="center">
    <a href="${user.html_url}">
      <img src="${user.avatar_url}" />
      <br />
      ${user.name || user.login}
    </a> 
  </td>`)
  const rows = Array(numberOfRows).fill(0).map((_, i) =>
    `<tr>${usersHTML.slice(i * usersPerRow, (i + 1) * usersPerRow).join('\n')}</tr>`)
  return `\n<table>${rows.join('\n')}</table>\n`
}

async function getCoolPeople(repo, token) {
  let url = `https://api.github.com/repos/${repo}/stargazers?per_page=100`
  const options = {
    headers: {
      'Authorization': token,
      'User-Agent': 'Get Cool People Action'
    }
  }
  const coolPeople = []
  while (true) {
    const { body: people, headers: { link } } = await request(url, options)
    coolPeople.push(...people)
    if (!link) break
    const next = link.match(/(?<=<)[a-z:\/.\d?_&=]+(?=>; *rel="next")/)
    if (!next) break
    url = next[0]
  }
  return coolPeople
}

async function request(url, options) {
  return new Promise((resolve, reject) => {
    https.get(url, options, res => {
      let body = ''

      if (res.statusCode >= 400) {
        reject({
          code: res.statusCode,
          message: res.statusMessage
        })
      }

      res.on('data', (chunk) => {
        body += chunk
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({
            body: json,
            headers: res.headers,
          })
        } catch (error) {
          reject(error)
        };
      });
    }).on('error', reject)
  })
}
