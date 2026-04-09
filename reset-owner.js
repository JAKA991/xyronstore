const fs = require('fs');
const bcrypt = require('bcryptjs');

const password = 'JakSky221007';
const hash = bcrypt.hashSync(password, 10);

const users = [
  {
    id: 1,
    username: 'Jaksky2029',
    passwordHash: hash,
    role: 'owner',
    status: 'active',
    activeSessionId: null,
    createdAt: new Date().toISOString()
  }
];

fs.writeFileSync('users.json', JSON.stringify(users, null, 2));

console.log('RESET OK');
console.log('USERNAME: Jaksky2029');
console.log('PASSWORD: JakSky221007');
console.log('HASH MATCH:', bcrypt.compareSync('JakSky221007', hash));
