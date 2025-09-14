const bcrypt = require('bcryptjs');

// Password per il super admin
const password = 'SuperAdmin123!';

// Genera l'hash
bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Password:', password);
        console.log('Hash:', hash);
    }
});