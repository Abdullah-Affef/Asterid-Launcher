import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';

const AUTH_BASE = 'https://account.ely.by';
const REDIRECT_URI = 'http://localhost:38471/callback';
const ACCOUNTS_PATH = path.join(app.getPath('userData'), 'accounts.json');

export interface Account {
  uuid: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiry: number;
  offline: boolean;
}

let accounts: Account[] = [];
let currentAccount: Account | null = null;

function loadAccounts() {
  try {
    if (fs.existsSync(ACCOUNTS_PATH)) {
      accounts = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf-8'));
    }
  } catch { accounts = []; }
}

function saveAccounts() {
  fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
}

export function getAccounts(): Account[] {
  loadAccounts();
  return accounts;
}

export function getCurrentAccount(): Account | null {
  loadAccounts();
  return currentAccount;
}

export function setCurrentAccount(uuid: string) {
  loadAccounts();
  currentAccount = accounts.find(a => a.uuid === uuid) || null;
}

export function removeAccount(uuid: string) {
  loadAccounts();
  accounts = accounts.filter(a => a.uuid !== uuid);
  if (currentAccount?.uuid === uuid) currentAccount = null;
  saveAccounts();
}

export function loginOffline(username: string): Account {
  const normalized = username.trim() || 'Player';
  const uuid = uuidv4();
  const account: Account = {
    uuid,
    username: normalized,
    accessToken: 'offline',
    refreshToken: '',
    expiry: Infinity,
    offline: true,
  };
  loadAccounts();
  const existing = accounts.findIndex(a => a.uuid === account.uuid);
  if (existing >= 0) accounts[existing] = account;
  else accounts.push(account);
  currentAccount = account;
  saveAccounts();
  return account;
}

export async function loginWithElyBy(mainWindow: BrowserWindow, clientId: string): Promise<Account | null> {
  const navigateBack = () => {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  };

  return new Promise((resolve, reject) => {
    let server: http.Server | null = null;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      mainWindow.webContents.removeListener('did-fail-load', onFailLoad);
      mainWindow.webContents.removeListener('did-navigate', onNavigate);
    };

    const finish = (err: Error | null, account?: Account) => {
      cleanup();
      navigateBack();
      if (err) reject(err);
      else resolve(account || null);
    };

    const onFailLoad = (_e: any, code: number, desc: string) => {
      if (desc.includes('ERR_ABORTED')) return;
      if (server) server.close();
      finish(new Error(`Auth page failed: ${desc}`));
    };

    const onNavigate = (_e: any, url: string) => {
      if (!url.startsWith('http://localhost:38471/callback')) return;
      const u = new URL(url);
      const code = u.searchParams.get('code');
      const errParam = u.searchParams.get('error');
      if (server) server.close();
      if (errParam) { finish(new Error(`Ely.by error: ${errParam}`)); return; }
      if (!code) { finish(new Error('No auth code received')); return; }
      exchangeCode(code).then(account => {
        loadAccounts();
        const existing = accounts.findIndex(a => a.uuid === account.uuid);
        if (existing >= 0) accounts[existing] = account;
        else accounts.push(account);
        currentAccount = account;
        saveAccounts();
        finish(null, account);
      }).catch(e => finish(e));
    };

    mainWindow.webContents.on('did-fail-load', onFailLoad);
    mainWindow.webContents.on('did-navigate', onNavigate);

    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<p>Authentication complete. You can close this window.</p>');
    });

    server.listen(38471, () => {
      const authUrl = `${AUTH_BASE}/oauth2/v1/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=account_info%20offline_access`;
      mainWindow.loadURL(authUrl).catch((err) => {
        if (server) server.close();
        finish(new Error(`Failed to load Ely.by auth: ${err.message}`));
      });
    });
  });
}

async function exchangeCode(code: string): Promise<Account> {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  let clientId = 'minecraft-launcher';
  try {
    const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    if (settingsData.elyClientId) clientId = settingsData.elyClientId;
  } catch {}

  const tokenResponse = await fetch(`${AUTH_BASE}/oauth2/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) throw new Error('Token exchange failed');
  const tokenData: any = await tokenResponse.json();

  let uuid = '';
  let username = '';

  const userResponse = await fetch(`${AUTH_BASE}/api/account/v1/info`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (userResponse.ok) {
    const userData: any = await userResponse.json();
    uuid = userData.uuid || '';
    username = userData.username || '';
  }

  return {
    uuid,
    username,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || '',
    expiry: Date.now() + (tokenData.expires_in || 3600) * 1000,
    offline: false,
  };
}

export async function refreshToken(account: Account): Promise<Account | null> {
  if (account.offline) return account;
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let clientId = 'minecraft-launcher';
    try {
      const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settingsData.elyClientId) clientId = settingsData.elyClientId;
    } catch {}

    const response = await fetch(`${AUTH_BASE}/oauth2/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
      }),
    });

    if (!response.ok) return null;
    const data: any = await response.json();

    return {
      ...account,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || account.refreshToken,
      expiry: Date.now() + (data.expires_in || 3600) * 1000,
    };
  } catch {
    return null;
  }
}

export async function ensureValidToken(account: Account): Promise<Account | null> {
  if (Date.now() < account.expiry - 60000) return account;
  const refreshed = await refreshToken(account);
  if (refreshed) {
    loadAccounts();
    const idx = accounts.findIndex(a => a.uuid === account.uuid);
    if (idx >= 0) accounts[idx] = refreshed;
    if (currentAccount?.uuid === account.uuid) currentAccount = refreshed;
    saveAccounts();
  }
  return refreshed;
}
