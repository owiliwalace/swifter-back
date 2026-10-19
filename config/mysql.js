import './env.js';
import mysql from 'mysql2/promise';
import {mysqlOptions} from './mysql-options.js';

// Connection preparation only: application repositories use Firebase.
// Creating a pool is explicit so importing this module does not connect.
export function createMysqlPool(){return mysql.createPool(mysqlOptions());}
