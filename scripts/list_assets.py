#!/usr/bin/env python3
import sqlite3
import json
import sys

DB_PATH = 'sovereigns_interbank_vault.db'
EMAIL = 'whenwerisee@gmail.com'

def main():
    try:
        conn = sqlite3.connect(DB_PATH)
    except Exception as e:
        print('ERROR: cannot open DB:', e)
        sys.exit(2)
    cur = conn.cursor()
    cur.execute('SELECT id, name, email, kycLevel, citizenship FROM users WHERE email = ?', (EMAIL,))
    users = cur.fetchall()
    if not users:
        print('User not found for', EMAIL)
        conn.close()
        return
    user = users[0]
    print('=== YOUR ACCOUNT ===')
    print(json.dumps({'id': user[0], 'name': user[1], 'email': user[2], 'kycLevel': user[3], 'citizenship': user[4]}, indent=2))

    cur.execute('SELECT id, user_id, asset_symbol, balance, public_address_ethereum, public_address_bitcoin FROM wallets WHERE user_id = ?', (user[0],))
    wallets = cur.fetchall()
    print('\n=== YOUR ASSETS ===')
    if wallets:
        for w in wallets:
            print(f"  {w[2]}: {w[3]}")
        print('\nDetailed:')
        wallets_list = []
        for w in wallets:
            wallets_list.append({
                'id': w[0], 'user_id': w[1], 'asset_symbol': w[2], 'balance': w[3],
                'public_address_ethereum': w[4], 'public_address_bitcoin': w[5]
            })
        print(json.dumps(wallets_list, indent=2))
    else:
        print('  No assets found')
    conn.close()

if __name__ == '__main__':
    main()
