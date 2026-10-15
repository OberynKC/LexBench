import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up(db) {
      db.exec(`
        CREATE TABLE app_meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        ) WITHOUT ROWID;

        CREATE TABLE clients (
          id      TEXT PRIMARY KEY,
          name    TEXT NOT NULL,
          type    TEXT NOT NULL CHECK (type IN ('个人', '企业')),
          phone   TEXT NOT NULL DEFAULT '',
          email   TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL DEFAULT '',
          note    TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_clients_name ON clients(name);

        CREATE TABLE cases (
          id              TEXT PRIMARY KEY,
          case_number     TEXT,
          title           TEXT NOT NULL,
          type            TEXT NOT NULL CHECK (type IN ('民事', '刑事', '行政', '仲裁', '非诉')),
          template_id     TEXT NOT NULL,
          stage_id        TEXT NOT NULL,
          side            TEXT NOT NULL CHECK (side IN (
                            '原告方', '被告方', '上诉人方', '被上诉人方',
                            '申请人方', '被申请人方', '申请执行人方', '被执行人方',
                            '辩护人', '被害人方', '自诉人方', '案外人/第三人', '无对抗立场'
                          )),
          client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
          opposing_party  TEXT NOT NULL DEFAULT '',
          court           TEXT NOT NULL DEFAULT '',
          judge           TEXT NOT NULL DEFAULT '',
          judge_phone     TEXT NOT NULL DEFAULT '',
          amount_cents    INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
          accepted_at     TEXT NOT NULL,
          next_deadline   TEXT NOT NULL,
          note            TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_cases_client ON cases(client_id);
        CREATE INDEX idx_cases_type ON cases(type);
        CREATE INDEX idx_cases_template ON cases(template_id);
        CREATE INDEX idx_cases_deadline ON cases(next_deadline);

        CREATE TABLE case_related (
          case_id         TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
          related_case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
          sort_order      INTEGER NOT NULL CHECK (sort_order >= 0),
          PRIMARY KEY (case_id, related_case_id),
          UNIQUE (case_id, sort_order),
          CHECK (case_id <> related_case_id)
        );
        CREATE INDEX idx_case_related_reverse ON case_related(related_case_id);

        CREATE TABLE contracts (
          id               TEXT PRIMARY KEY,
          contract_no      TEXT NOT NULL,
          client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
          signed_at        TEXT NOT NULL,
          fee_mode         TEXT NOT NULL CHECK (fee_mode IN ('固定收费', '风险代理', '半风险代理', '计时收费')),
          total_fee_cents  INTEGER NOT NULL DEFAULT 0 CHECK (total_fee_cents >= 0),
          status           TEXT NOT NULL CHECK (status IN ('履行中', '已完结', '已解除')),
          note             TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_contracts_client ON contracts(client_id);
        CREATE INDEX idx_contracts_signed_at ON contracts(signed_at);

        CREATE TABLE contract_cases (
          contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
          case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
          sort_order  INTEGER NOT NULL CHECK (sort_order >= 0),
          PRIMARY KEY (contract_id, case_id),
          UNIQUE (contract_id, sort_order)
        );
        CREATE INDEX idx_contract_cases_case ON contract_cases(case_id);

        CREATE TABLE fee_records (
          id                    TEXT PRIMARY KEY,
          contract_id           TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
          label                 TEXT NOT NULL,
          amount_cents          INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
          due_date              TEXT NOT NULL,
          received_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (received_amount_cents >= 0),
          received_at           TEXT NOT NULL DEFAULT '',
          note                  TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_fee_records_contract ON fee_records(contract_id);
        CREATE INDEX idx_fee_records_due_date ON fee_records(due_date);

        CREATE TABLE invoices (
          id           TEXT PRIMARY KEY,
          contract_id  TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
          invoice_no   TEXT NOT NULL,
          kind         TEXT NOT NULL CHECK (kind IN ('增值税普通发票', '增值税专用发票')),
          amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
          issued_at    TEXT NOT NULL,
          note         TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_invoices_contract ON invoices(contract_id);
        CREATE INDEX idx_invoices_issued_at ON invoices(issued_at);

        CREATE TABLE file_meta (
          id          TEXT PRIMARY KEY,
          contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
          invoice_id  TEXT REFERENCES invoices(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          size        INTEGER NOT NULL DEFAULT 0 CHECK (size >= 0),
          uploaded_at TEXT NOT NULL,
          sort_order  INTEGER NOT NULL CHECK (sort_order >= 0),
          CHECK (
            (contract_id IS NOT NULL AND invoice_id IS NULL) OR
            (contract_id IS NULL AND invoice_id IS NOT NULL)
          )
        );
        CREATE INDEX idx_file_meta_contract ON file_meta(contract_id);
        CREATE INDEX idx_file_meta_invoice ON file_meta(invoice_id);
        CREATE UNIQUE INDEX idx_file_meta_contract_order
          ON file_meta(contract_id, sort_order)
          WHERE contract_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_file_meta_invoice_order
          ON file_meta(invoice_id, sort_order)
          WHERE invoice_id IS NOT NULL;

        CREATE TABLE notes (
          id         TEXT PRIMARY KEY,
          case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
          title      TEXT NOT NULL,
          content    TEXT NOT NULL DEFAULT '',
          tags_json  TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_notes_case ON notes(case_id);
        CREATE INDEX idx_notes_updated_at ON notes(updated_at);

        CREATE TABLE preservations (
          id       TEXT PRIMARY KEY,
          case_id  TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
          type     TEXT NOT NULL CHECK (type IN ('财产保全', '行为保全', '证据保全', '先予执行', '查封扣押')),
          deadline TEXT,
          status   TEXT NOT NULL CHECK (status IN ('申请', '生效', '结束')),
          note     TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX idx_preservations_case ON preservations(case_id);
        CREATE INDEX idx_preservations_deadline ON preservations(deadline);

        CREATE TABLE todos (
          id         TEXT PRIMARY KEY,
          title      TEXT NOT NULL,
          case_id    TEXT REFERENCES cases(id) ON DELETE SET NULL,
          done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
          deadline   TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_todos_case ON todos(case_id);
        CREATE INDEX idx_todos_deadline ON todos(deadline);
        CREATE INDEX idx_todos_done ON todos(done);

        CREATE TABLE calendar_events (
          id        TEXT PRIMARY KEY,
          title     TEXT NOT NULL,
          type      TEXT NOT NULL CHECK (type IN ('开庭', '会见', '截止期限', '其他')),
          case_id   TEXT REFERENCES cases(id) ON DELETE SET NULL,
          starts_at TEXT NOT NULL,
          ends_at   TEXT NOT NULL,
          location  TEXT NOT NULL DEFAULT '',
          reminder  TEXT NOT NULL DEFAULT '',
          todo_id   TEXT REFERENCES todos(id) ON DELETE CASCADE,
          CHECK (ends_at >= starts_at)
        );
        CREATE INDEX idx_calendar_events_case ON calendar_events(case_id);
        CREATE INDEX idx_calendar_events_start ON calendar_events(starts_at);
        CREATE UNIQUE INDEX idx_calendar_events_todo
          ON calendar_events(todo_id)
          WHERE todo_id IS NOT NULL;
      `)
    },
  },
  {
    version: 2,
    name: 'store real attachments and support case files',
    up(db) {
      // SQLite 不能原地修改 CHECK；重建表以增加案件归属及真实文件路径字段。
      // 旧版本只有元数据、没有可复制的源文件，因此以空路径保留旧记录，避免伪造文件内容。
      db.exec(`
        ALTER TABLE file_meta RENAME TO file_meta_v1;

        DROP INDEX idx_file_meta_contract;
        DROP INDEX idx_file_meta_invoice;
        DROP INDEX idx_file_meta_contract_order;
        DROP INDEX idx_file_meta_invoice_order;

        CREATE TABLE file_meta (
          id          TEXT PRIMARY KEY,
          contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,
          invoice_id  TEXT REFERENCES invoices(id) ON DELETE CASCADE,
          case_id     TEXT REFERENCES cases(id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          stored_name TEXT NOT NULL DEFAULT '',
          rel_path    TEXT NOT NULL DEFAULT '',
          size        INTEGER NOT NULL DEFAULT 0 CHECK (size >= 0),
          uploaded_at TEXT NOT NULL,
          sort_order  INTEGER NOT NULL CHECK (sort_order >= 0),
          CHECK (
            (contract_id IS NOT NULL AND invoice_id IS NULL AND case_id IS NULL) OR
            (contract_id IS NULL AND invoice_id IS NOT NULL AND case_id IS NULL) OR
            (contract_id IS NULL AND invoice_id IS NULL AND case_id IS NOT NULL)
          )
        );

        INSERT INTO file_meta (
          id, contract_id, invoice_id, case_id, name, stored_name, rel_path, size, uploaded_at, sort_order
        )
        SELECT id, contract_id, invoice_id, NULL, name, '', '', size, uploaded_at, sort_order
        FROM file_meta_v1;

        DROP TABLE file_meta_v1;

        CREATE INDEX idx_file_meta_contract ON file_meta(contract_id);
        CREATE INDEX idx_file_meta_invoice ON file_meta(invoice_id);
        CREATE INDEX idx_file_meta_case ON file_meta(case_id);
        CREATE UNIQUE INDEX idx_file_meta_contract_order
          ON file_meta(contract_id, sort_order)
          WHERE contract_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_file_meta_invoice_order
          ON file_meta(invoice_id, sort_order)
          WHERE invoice_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_file_meta_case_order
          ON file_meta(case_id, sort_order)
          WHERE case_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_file_meta_rel_path
          ON file_meta(rel_path)
          WHERE rel_path <> '';
      `)
    },
  },
  {
    version: 3,
    name: 'note drafts and version history',
    up(db) {
      db.exec(`
        CREATE TABLE note_versions (
          id         TEXT PRIMARY KEY,
          note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
          title      TEXT NOT NULL,
          content    TEXT NOT NULL,
          tags_json  TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_note_versions_note ON note_versions(note_id, created_at);

        CREATE TABLE note_drafts (
          note_id    TEXT PRIMARY KEY,
          -- 新建草稿没有正式笔记；生成列使其与已有草稿共用外键级联规则。
          note_ref_id TEXT GENERATED ALWAYS AS (NULLIF(note_id, '__new__')) STORED
                      REFERENCES notes(id) ON DELETE CASCADE,
          case_id    TEXT REFERENCES cases(id) ON DELETE CASCADE,
          title      TEXT NOT NULL,
          content    TEXT NOT NULL,
          tags_json  TEXT NOT NULL,
          saved_at   TEXT NOT NULL
        );
      `)
    },
  },
  {
    version: 4,
    name: 'deadline reminder delivery log',
    up(db) {
      db.exec(`
        CREATE TABLE reminder_log (
          id TEXT PRIMARY KEY,
          item_key TEXT NOT NULL,
          channel TEXT NOT NULL,
          threshold_bucket TEXT NOT NULL,
          sent_at TEXT NOT NULL,
          UNIQUE(item_key, channel, threshold_bucket)
        );
      `)
    },
  },
]

export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue
    const apply = db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })
    apply()
  }
}
