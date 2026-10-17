import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const trades=sqliteTable('trades',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const preferences=sqliteTable('preferences',{id:text('id').primaryKey(),payload:text('payload').notNull()});

export const users=sqliteTable('app_users',{id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),passwordHash:text('password_hash').notNull(),recoveryHash:text('recovery_hash').notNull(),createdAt:integer('created_at').notNull()});
export const authSessions=sqliteTable('auth_sessions',{credentialVersion:text('credential_version').notNull(),tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),expiresAt:integer('expires_at').notNull()});
export const authLimits=sqliteTable('auth_limits',{id:text('id').primaryKey(),attempts:integer('attempts').notNull(),expiresAt:integer('expires_at').notNull()});
export const userTrades=sqliteTable('user_trades',{id:text('id').notNull(),userId:text('user_id').notNull().references(()=>users.id),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const userPreferences=sqliteTable('user_preferences',{id:text('id').notNull(),userId:text('user_id').notNull().references(()=>users.id),payload:text('payload').notNull()},t=>[primaryKey({columns:[t.userId,t.id]})]);
export const userImages=sqliteTable('user_images',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),objectKey:text('object_key').notNull()});
export const legacyClaims=sqliteTable('legacy_claims',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id)});
