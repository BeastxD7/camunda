import { bankDbPool } from "../lib/bank-db.js";

type TableRef = {
	tableSchema: string;
	tableName: string;
};

type ColumnRef = {
	tableSchema: string;
	tableName: string;
	ordinalPosition: number;
	columnName: string;
	dataType: string;
	isNullable: boolean;
	columnDefault: string | null;
};

type PrimaryKeyRef = {
	tableSchema: string;
	tableName: string;
	columnName: string;
};

type ForeignKeyRef = {
	tableSchema: string;
	tableName: string;
	columnName: string;
	foreignTableSchema: string;
	foreignTableName: string;
	foreignColumnName: string;
};

type TableRowCountRef = {
	tableSchema: string;
	tableName: string;
	rowCountEstimate: number;
};

type BankTableSummary = {
	tableSchema: string;
	tableName: string;
	rowCountEstimate: number;
	columnCount: number;
	hasPrimaryKey: boolean;
};

type BankTableData = {
	tableSchema: string;
	tableName: string;
	limit: number;
	offset: number;
	totalCount: number;
	columns: string[];
	rows: Array<Record<string, unknown>>;
};

type BankCustomerRecord = {
	id: number;
	createdAt: string | null;
	customerName: string | null;
	email: string | null;
	mobile: string | null;
	age: number | null;
	income: number | null;
	residency: string | null;
	creditScore: number | null;
};

type BankCustomersPage = {
	limit: number;
	offset: number;
	totalCount: number;
	items: BankCustomerRecord[];
};

type BankCardRecord = {
	id: number;
	createdAt: string | null;
	customerName: string | null;
	email: string | null;
	cardName: string | null;
	annualSpend: number | null;
	latePayments: number | null;
	tenure: number | null;
};

type BankCardsPage = {
	email: string;
	limit: number;
	offset: number;
	totalCount: number;
	items: BankCardRecord[];
};

type BankTransactionRecord = {
	transactionId: string;
	email: string | null;
	amount: number | null;
	merchantName: string | null;
	internalStatus: string | null;
	createdAt: string | null;
	raw: Record<string, unknown>;
};

type BankTransactionsPage = {
	email: string;
	limit: number;
	offset: number;
	totalCount: number;
	items: BankTransactionRecord[];
};

type ScreeningMemberRecord = {
	id: string;
	fullName: string | null;
	email: string | null;
	mobile: string | null;
	status: string | null;
	raw: Record<string, unknown>;
};

type ScreeningMembersPage = {
	limit: number;
	offset: number;
	totalCount: number;
	items: ScreeningMemberRecord[];
};

type ScreeningActivityLogRecord = {
	id: string;
	memberId: string | null;
	fullName: string | null;
	actionType: string | null;
	description: string | null;
	createdAt: string | null;
	raw: Record<string, unknown>;
};

type ScreeningActivityLogsPage = {
	memberId: string;
	limit: number;
	offset: number;
	totalCount: number;
	items: ScreeningActivityLogRecord[];
};

type BankSchemaSummary = {
	database: string;
	user: string;
	generatedAt: string;
	tables: TableRef[];
	columns: ColumnRef[];
	primaryKeys: PrimaryKeyRef[];
	foreignKeys: ForeignKeyRef[];
	rowCountEstimates: TableRowCountRef[];
	suggestedJoinKeys: Array<{
		from: string;
		to: string;
		on: string[];
		notes: string;
	}>;
};

async function getBankSchemaSummary(): Promise<BankSchemaSummary> {
	const identityResult = await bankDbPool.query<{
		current_database: string;
		current_user: string;
	}>("SELECT current_database(), current_user;");

	const identity = identityResult.rows[0];
	if (!identity) {
		throw new Error("Unable to resolve bank database identity");
	}

	const tablesResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
	}>(
		`SELECT table_schema, table_name
		 FROM information_schema.tables
		 WHERE table_type = 'BASE TABLE'
		   AND table_schema NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY table_schema, table_name;`,
	);

	const columnsResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
		ordinal_position: number;
		column_name: string;
		data_type: string;
		is_nullable: "YES" | "NO";
		column_default: string | null;
	}>(
		`SELECT table_schema, table_name, ordinal_position, column_name, data_type, is_nullable, column_default
		 FROM information_schema.columns
		 WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY table_schema, table_name, ordinal_position;`,
	);

	const primaryKeysResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
		column_name: string;
	}>(
		`SELECT tc.table_schema, tc.table_name, kcu.column_name
		 FROM information_schema.table_constraints AS tc
		 JOIN information_schema.key_column_usage AS kcu
		   ON tc.constraint_name = kcu.constraint_name
		  AND tc.table_schema = kcu.table_schema
		 WHERE tc.constraint_type = 'PRIMARY KEY'
		   AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position;`,
	);

	const foreignKeysResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
		column_name: string;
		foreign_table_schema: string;
		foreign_table_name: string;
		foreign_column_name: string;
	}>(
		`SELECT tc.table_schema,
		        tc.table_name,
		        kcu.column_name,
		        ccu.table_schema AS foreign_table_schema,
		        ccu.table_name AS foreign_table_name,
		        ccu.column_name AS foreign_column_name
		 FROM information_schema.table_constraints AS tc
		 JOIN information_schema.key_column_usage AS kcu
		   ON tc.constraint_name = kcu.constraint_name
		  AND tc.table_schema = kcu.table_schema
		 JOIN information_schema.constraint_column_usage AS ccu
		   ON ccu.constraint_name = tc.constraint_name
		  AND ccu.table_schema = tc.table_schema
		 WHERE tc.constraint_type = 'FOREIGN KEY'
		   AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY tc.table_schema, tc.table_name, kcu.column_name;`,
	);

	const rowCountsResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
		row_count_estimate: string;
	}>(
		`SELECT schemaname AS table_schema,
		        relname AS table_name,
		        COALESCE(n_live_tup, 0)::bigint AS row_count_estimate
		 FROM pg_stat_user_tables
		 WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY schemaname, relname;`,
	);

	return {
		database: identity.current_database,
		user: identity.current_user,
		generatedAt: new Date().toISOString(),
		tables: tablesResult.rows.map((row) => ({
			tableSchema: row.table_schema,
			tableName: row.table_name,
		})),
		columns: columnsResult.rows.map((row) => ({
			tableSchema: row.table_schema,
			tableName: row.table_name,
			ordinalPosition: row.ordinal_position,
			columnName: row.column_name,
			dataType: row.data_type,
			isNullable: row.is_nullable === "YES",
			columnDefault: row.column_default,
		})),
		primaryKeys: primaryKeysResult.rows.map((row) => ({
			tableSchema: row.table_schema,
			tableName: row.table_name,
			columnName: row.column_name,
		})),
		foreignKeys: foreignKeysResult.rows.map((row) => ({
			tableSchema: row.table_schema,
			tableName: row.table_name,
			columnName: row.column_name,
			foreignTableSchema: row.foreign_table_schema,
			foreignTableName: row.foreign_table_name,
			foreignColumnName: row.foreign_column_name,
		})),
		rowCountEstimates: rowCountsResult.rows.map((row) => ({
			tableSchema: row.table_schema,
			tableName: row.table_name,
			rowCountEstimate: Number(row.row_count_estimate) || 0,
		})),
		suggestedJoinKeys: [
			{
				from: "public.customer_data",
				to: "public.cards",
				on: ["email", "customer_name"],
				notes: "No foreign keys are defined; these are inferred join keys.",
			},
			{
				from: "public.customer_data",
				to: "public.transactions",
				on: ["email"],
				notes: "No foreign keys are defined; this is inferred from column overlap.",
			},
			{
				from: "public.screening_members_advanced",
				to: "public.member_activity_logs",
				on: ["id = member_id"],
				notes: "Potential UUID link based on column naming.",
			},
		],
	};
}

async function getBankTables(): Promise<BankTableSummary[]> {
	const tablesResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
	}>(
		`SELECT table_schema, table_name
		 FROM information_schema.tables
		 WHERE table_type = 'BASE TABLE'
		   AND table_schema NOT IN ('pg_catalog', 'information_schema')
		 ORDER BY table_schema, table_name;`,
	);

	const columnCountsResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
		column_count: string;
	}>(
		`SELECT table_schema,
		        table_name,
		        COUNT(*)::bigint AS column_count
		 FROM information_schema.columns
		 WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
		 GROUP BY table_schema, table_name;`,
	);

	const primaryKeysResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
	}>(
		`SELECT DISTINCT tc.table_schema, tc.table_name
		 FROM information_schema.table_constraints AS tc
		 WHERE tc.constraint_type = 'PRIMARY KEY'
		   AND tc.table_schema NOT IN ('pg_catalog', 'information_schema');`,
	);

	const rowCountsResult = await bankDbPool.query<{
		table_schema: string;
		table_name: string;
		row_count_estimate: string;
	}>(
		`SELECT schemaname AS table_schema,
		        relname AS table_name,
		        COALESCE(n_live_tup, 0)::bigint AS row_count_estimate
		 FROM pg_stat_user_tables
		 WHERE schemaname NOT IN ('pg_catalog', 'information_schema');`,
	);

	const columnCountsByTable = new Map<string, number>(
		columnCountsResult.rows.map((row) => [
			`${row.table_schema}.${row.table_name}`,
			Number(row.column_count) || 0,
		]),
	);

	const primaryKeyTableSet = new Set<string>(
		primaryKeysResult.rows.map((row) => `${row.table_schema}.${row.table_name}`),
	);

	const rowCountsByTable = new Map<string, number>(
		rowCountsResult.rows.map((row) => [
			`${row.table_schema}.${row.table_name}`,
			Number(row.row_count_estimate) || 0,
		]),
	);

	return tablesResult.rows.map((row) => {
		const key = `${row.table_schema}.${row.table_name}`;
		return {
			tableSchema: row.table_schema,
			tableName: row.table_name,
			rowCountEstimate: rowCountsByTable.get(key) ?? 0,
			columnCount: columnCountsByTable.get(key) ?? 0,
			hasPrimaryKey: primaryKeyTableSet.has(key),
		};
	});
}

function isSafeIdentifier(value: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replace(/"/g, '""')}"`;
}

async function getBankTableData(params: {
	tableSchema: string;
	tableName: string;
	limit?: number;
	offset?: number;
}): Promise<BankTableData> {
	const tableSchema = params.tableSchema.trim();
	const tableName = params.tableName.trim();
	const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
	const offset = Math.max(params.offset ?? 0, 0);

	if (!isSafeIdentifier(tableSchema) || !isSafeIdentifier(tableName)) {
		throw new Error("Invalid schema/table identifier. Only letters, digits, and underscores are allowed.");
	}

	const tableExistsResult = await bankDbPool.query<{ exists: boolean }>(
		`SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = $1
			  AND table_name = $2
			  AND table_type = 'BASE TABLE'
		) AS exists;`,
		[tableSchema, tableName],
	);

	if (!tableExistsResult.rows[0]?.exists) {
		throw new Error(`Table ${tableSchema}.${tableName} does not exist`);
	}

	const columnsResult = await bankDbPool.query<{ column_name: string }>(
		`SELECT column_name
		 FROM information_schema.columns
		 WHERE table_schema = $1
		   AND table_name = $2
		 ORDER BY ordinal_position;`,
		[tableSchema, tableName],
	);

	const columns = columnsResult.rows.map((row) => row.column_name);

	const countQuery = `SELECT COUNT(*)::bigint AS total_count FROM ${quoteIdentifier(tableSchema)}.${quoteIdentifier(tableName)};`;
	const totalCountResult = await bankDbPool.query<{ total_count: string }>(countQuery);
	const totalCount = Number(totalCountResult.rows[0]?.total_count ?? 0) || 0;

	const dataQuery = `SELECT * FROM ${quoteIdentifier(tableSchema)}.${quoteIdentifier(tableName)} LIMIT $1 OFFSET $2;`;
	const dataResult = await bankDbPool.query<Record<string, unknown>>(dataQuery, [limit, offset]);

	return {
		tableSchema,
		tableName,
		limit,
		offset,
		totalCount,
		columns,
		rows: dataResult.rows,
	};
}

function clampPage(limit?: number, offset?: number) {
	return {
		limit: Math.min(Math.max(limit ?? 50, 1), 200),
		offset: Math.max(offset ?? 0, 0),
	};
}

async function getBankCustomers(params: {
	search?: string;
	limit?: number;
	offset?: number;
}): Promise<BankCustomersPage> {
	const { limit, offset } = clampPage(params.limit, params.offset);
	const search = (params.search ?? "").trim();
	const hasSearch = search.length > 0;

	const countQuery = `SELECT COUNT(*)::bigint AS total_count
	                  FROM public.customer_data
	                  WHERE ($1::text = '' OR customer_name ILIKE $2 OR email ILIKE $2);`;
	const countResult = await bankDbPool.query<{ total_count: string }>(countQuery, [search, `%${search}%`]);

	const dataQuery = `SELECT id,
	                         created_at,
	                         customer_name,
	                         email,
	                         mobile,
	                         age,
	                         income,
	                         residency,
	                         credit_score
	                  FROM public.customer_data
	                  WHERE ($1::text = '' OR customer_name ILIKE $2 OR email ILIKE $2)
	                  ORDER BY id ASC
	                  LIMIT $3 OFFSET $4;`;

	const dataResult = await bankDbPool.query<{
		id: number;
		created_at: Date | string | null;
		customer_name: string | null;
		email: string | null;
		mobile: string | null;
		age: number | null;
		income: number | null;
		residency: string | null;
		credit_score: number | null;
	}>(dataQuery, [hasSearch ? search : "", `%${search}%`, limit, offset]);

	return {
		limit,
		offset,
		totalCount: Number(countResult.rows[0]?.total_count ?? 0) || 0,
		items: dataResult.rows.map((row) => ({
			id: row.id,
			createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
			customerName: row.customer_name,
			email: row.email,
			mobile: row.mobile,
			age: row.age,
			income: row.income,
			residency: row.residency,
			creditScore: row.credit_score,
		})),
	};
}

async function getCardsByCustomerEmail(params: {
	email: string;
	limit?: number;
	offset?: number;
}): Promise<BankCardsPage> {
	const email = params.email.trim();
	if (!email) {
		throw new Error("Customer email is required");
	}

	const { limit, offset } = clampPage(params.limit, params.offset);

	const countResult = await bankDbPool.query<{ total_count: string }>(
		`SELECT COUNT(*)::bigint AS total_count
		 FROM public.cards
		 WHERE email = $1;`,
		[email],
	);

	const rowsResult = await bankDbPool.query<{
		id: number;
		created_at: Date | string | null;
		customer_name: string | null;
		email: string | null;
		"card name": string | null;
		"Annual Spend": number | null;
		late_payments: number | null;
		tenure: number | null;
	}>(
		`SELECT id,
		        created_at,
		        customer_name,
		        email,
		        "card name",
		        "Annual Spend",
		        late_payments,
		        tenure
		 FROM public.cards
		 WHERE email = $1
		 ORDER BY id ASC
		 LIMIT $2 OFFSET $3;`,
		[email, limit, offset],
	);

	return {
		email,
		limit,
		offset,
		totalCount: Number(countResult.rows[0]?.total_count ?? 0) || 0,
		items: rowsResult.rows.map((row) => ({
			id: row.id,
			createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
			customerName: row.customer_name,
			email: row.email,
			cardName: row["card name"],
			annualSpend: row["Annual Spend"],
			latePayments: row.late_payments,
			tenure: row.tenure,
		})),
	};
}

async function getTransactionsByCustomerEmail(params: {
	email: string;
	limit?: number;
	offset?: number;
}): Promise<BankTransactionsPage> {
	const email = params.email.trim();
	if (!email) {
		throw new Error("Customer email is required");
	}

	const { limit, offset } = clampPage(params.limit, params.offset);

	const countResult = await bankDbPool.query<{ total_count: string }>(
		`SELECT COUNT(*)::bigint AS total_count
		 FROM public.transactions
		 WHERE email = $1;`,
		[email],
	);

	const rowsResult = await bankDbPool.query<Record<string, unknown>>(
		`SELECT *
		 FROM public.transactions
		 WHERE email = $1
		 ORDER BY transaction_id ASC
		 LIMIT $2 OFFSET $3;`,
		[email, limit, offset],
	);

	return {
		email,
		limit,
		offset,
		totalCount: Number(countResult.rows[0]?.total_count ?? 0) || 0,
		items: rowsResult.rows.map((row) => ({
			transactionId: typeof row.transaction_id === "string" ? row.transaction_id : String(row.transaction_id ?? ""),
			email: typeof row.email === "string" ? row.email : null,
			amount: typeof row.amount === "number" ? row.amount : row.amount ? Number(row.amount) : null,
			merchantName: typeof row.merchant_name === "string" ? row.merchant_name : null,
			internalStatus: typeof row.internal_status === "string" ? row.internal_status : null,
			createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
			raw: row,
		})),
	};
}

async function getScreeningMembers(params: {
	search?: string;
	limit?: number;
	offset?: number;
}): Promise<ScreeningMembersPage> {
	const { limit, offset } = clampPage(params.limit, params.offset);
	const search = (params.search ?? "").trim();

	const countResult = await bankDbPool.query<{ total_count: string }>(
		`SELECT COUNT(*)::bigint AS total_count
		 FROM public.screening_members_advanced
		 WHERE ($1::text = '' OR full_name ILIKE $2 OR "Email" ILIKE $2);`,
		[search, `%${search}%`],
	);

	const rowsResult = await bankDbPool.query<Record<string, unknown>>(
		`SELECT *
		 FROM public.screening_members_advanced
		 WHERE ($1::text = '' OR full_name ILIKE $2 OR "Email" ILIKE $2)
		 ORDER BY created_at DESC NULLS LAST
		 LIMIT $3 OFFSET $4;`,
		[search, `%${search}%`, limit, offset],
	);

	return {
		limit,
		offset,
		totalCount: Number(countResult.rows[0]?.total_count ?? 0) || 0,
		items: rowsResult.rows.map((row) => ({
			id: String(row.id ?? ""),
			fullName: typeof row.full_name === "string" ? row.full_name : null,
			email: typeof row.Email === "string" ? row.Email : null,
			mobile: typeof row.mobile === "string" ? row.mobile : null,
			status: typeof row.status === "string" ? row.status : null,
			raw: row,
		})),
	};
}

async function getScreeningActivityLogs(params: {
	memberId: string;
	limit?: number;
	offset?: number;
}): Promise<ScreeningActivityLogsPage> {
	const memberId = params.memberId.trim();
	if (!memberId) {
		throw new Error("memberId is required");
	}

	const { limit, offset } = clampPage(params.limit, params.offset);

	const countResult = await bankDbPool.query<{ total_count: string }>(
		`SELECT COUNT(*)::bigint AS total_count
		 FROM public.member_activity_logs
		 WHERE member_id::text = $1;`,
		[memberId],
	);

	const rowsResult = await bankDbPool.query<Record<string, unknown>>(
		`SELECT *
		 FROM public.member_activity_logs
		 WHERE member_id::text = $1
		 ORDER BY created_at DESC NULLS LAST
		 LIMIT $2 OFFSET $3;`,
		[memberId, limit, offset],
	);

	return {
		memberId,
		limit,
		offset,
		totalCount: Number(countResult.rows[0]?.total_count ?? 0) || 0,
		items: rowsResult.rows.map((row) => ({
			id: String(row.id ?? ""),
			memberId: row.member_id ? String(row.member_id) : null,
			fullName: typeof row.full_name === "string" ? row.full_name : null,
			actionType: typeof row.action_type === "string" ? row.action_type : null,
			description: typeof row.description === "string" ? row.description : null,
			createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
			raw: row,
		})),
	};
}

export {
	getBankSchemaSummary,
	getBankTables,
	getBankTableData,
	getBankCustomers,
	getCardsByCustomerEmail,
	getTransactionsByCustomerEmail,
	getScreeningMembers,
	getScreeningActivityLogs,
};
