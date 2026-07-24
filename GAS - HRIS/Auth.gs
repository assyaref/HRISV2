/**
 * Auth.gs - Authentication Service
 */

var AuthService = {
  login: function (email, password, remember) {
    if (!email || !password) return fail('Email dan password wajib diisi');

    var user = findByField(CONFIG.SHEETS.USERS, 'email', email);
    if (!user) {
      return fail('Email atau password salah');
    }

    // Support both hashed and plaintext passwords (migration period)
    var storedPassword = String(user.password);
    var inputHash = hashPassword(password);
    var passwordMatch = (storedPassword === inputHash) || (storedPassword === password);

    if (!passwordMatch) {
      return fail('Email atau password salah');
    }

    // Auto-upgrade: if password was stored plaintext, re-hash it
    if (storedPassword === password && storedPassword !== inputHash) {
      var sheet = getSheet(CONFIG.SHEETS.USERS);
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var idCol = headers.indexOf('id');
      var pwCol = headers.indexOf('password');
      for (var i = 1; i < data.length; i++) {
        if (data[i][idCol] === user.id) {
          sheet.getRange(i + 1, pwCol + 1).setValue(inputHash);
          break;
        }
      }
    }
    if (user.isActive === false || user.isActive === 'false') {
      return fail('Akun dinonaktifkan');
    }

    var token = generateToken();
    var hours = remember ? 720 : CONFIG.SESSION_HOURS; // 30 days if remember
    var expiresAt = Date.now() + hours * 60 * 60 * 1000;

    var session = {
      token: token,
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      employeeId: user.employeeId || '',
      avatar: user.avatar || '',
      expiresAt: expiresAt
    };

    appendObject(CONFIG.SHEETS.SESSIONS, session);
    addLog(user.id, user.name, 'LOGIN', 'Auth', 'Successful login');

    return {
      success: true,
      message: 'Login berhasil',
      data: session,
      token: token
    };
  },

  logout: function (token) {
    if (token) {
      var session = verifyToken(token);
      if (session) {
        addLog(session.userId, session.name, 'LOGOUT', 'Auth', '');
      }
      // Remove session
      var sheet = getSheet(CONFIG.SHEETS.SESSIONS);
      var data = sheet.getDataRange().getValues();
      var tokenCol = data[0].indexOf('token');
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][tokenCol] === token) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }
    return ok(null, 'Logout berhasil');
  },

  verifySession: function (token) {
    var session = verifyToken(token);
    if (!session) return fail('Sesi tidak valid');
    return ok(session);
  }
};
