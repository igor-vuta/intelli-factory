"""Replay migrations in isolated schemas, including representative historical data."""
import os
from pathlib import Path
import subprocess
from uuid import uuid4

url = os.environ["CATEGORY_TEST_DATABASE_URL"]
assert "127.0.0.1:55439/factory_categories_" in url
migrations = sorted(Path("prisma/migrations").glob("*/migration.sql"))
last = migrations[-1].read_text()
backfill = last[last.index('INSERT INTO "FactoryCategory"') : last.index("-- Small catalogue")]
old = "\n".join(p.read_text() for p in migrations[:-1])
fixture = """
INSERT INTO "User" (id,email,password_hash,role,updated_at) VALUES ('10000000-0000-4000-8000-000000000001','legacy@test.local','unused','FACTORY',now()), ('10000000-0000-4000-8000-000000000002','customer@test.local','unused','CUSTOMER',now());
INSERT INTO "Country" (id,iso2,iso3,default_name,updated_at) VALUES ('20000000-0000-4000-8000-000000000001','KZ','KAZ','Kazakhstan',now());
INSERT INTO "Region" (id,country_id,code,default_name,updated_at) VALUES ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','test','Region',now());
INSERT INTO "City" (id,region_id,default_name,updated_at) VALUES ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','City',now());
INSERT INTO "Address" (id,country_id,region_id,city_id,street,updated_at) VALUES ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Street 1',now());
INSERT INTO "FactoryProfile" (id,user_id,legal_name,updated_at) VALUES ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Existing factory',now());
INSERT INTO "CustomerProfile" (id,user_id,display_name,updated_at) VALUES ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Customer',now());
INSERT INTO "Category" (id,slug,default_name,updated_at) VALUES ('70000000-0000-4000-8000-000000000001','textile','Legacy name',now());
INSERT INTO "Item" (id,category_id,name,normalized_name,unit,updated_at) VALUES ('80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','Legacy product','legacy','kg',now());
INSERT INTO "Currency" (code,name,exchange_rate_to_base,updated_at) VALUES ('USD','USD',1,now());
INSERT INTO "InventoryEntry" (id,factory_profile_id,item_id,stock_address_id,quantity_available,price_per_unit,currency_code,status,updated_at) VALUES ('90000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',10,2,'USD','ACTIVE',now());
INSERT INTO "Request" (id,customer_profile_id,category_id,item_id,quantity,destination_address_id,preferred_currency_code,status,updated_at) VALUES ('a0000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',10,'50000000-0000-4000-8000-000000000001','USD','COMPLETED',now());
INSERT INTO "Transaction" (id,request_id,status,updated_at) VALUES ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','COMPLETED',now());
INSERT INTO "ContractPacket" (id,transaction_id,document_hash,terms_json) VALUES ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','historical-contract','{"terms":"preserved"}');
INSERT INTO "Signature" (id,transaction_id,user_id,role_at_signing,status,signed_at,updated_at) VALUES ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','FACTORY','SIGNED',now(),now());
CREATE TEMP TABLE contract_before AS SELECT * FROM "ContractPacket";
CREATE TEMP TABLE signature_before AS SELECT * FROM "Signature";
CREATE TEMP TABLE inventory_before AS SELECT * FROM "InventoryEntry";
CREATE TEMP TABLE request_before AS SELECT * FROM "Request";
"""
for populated in (False, True):
    schema = "category_migration_" + uuid4().hex
    assertions = """DO $$ BEGIN
      ASSERT (SELECT count(*) FROM "Category") = 4;
    END $$;"""
    if populated:
        assertions += """DO $$ BEGIN
          ASSERT (SELECT count(*) FROM "FactoryCategory") = 1;
          ASSERT (SELECT confirmed_at IS NULL FROM "FactoryCategory");
          ASSERT (SELECT id::text FROM "Category" WHERE slug='textile') = '70000000-0000-4000-8000-000000000001';
          ASSERT (SELECT default_name FROM "Category" WHERE slug='textile') = 'Legacy name';
          ASSERT NOT EXISTS ((SELECT * FROM "ContractPacket" EXCEPT SELECT * FROM contract_before) UNION (SELECT * FROM contract_before EXCEPT SELECT * FROM "ContractPacket"));
          ASSERT NOT EXISTS ((SELECT * FROM "Signature" EXCEPT SELECT * FROM signature_before) UNION (SELECT * FROM signature_before EXCEPT SELECT * FROM "Signature"));
          ASSERT NOT EXISTS ((SELECT * FROM "InventoryEntry" EXCEPT SELECT * FROM inventory_before) UNION (SELECT * FROM inventory_before EXCEPT SELECT * FROM "InventoryEntry"));
          ASSERT NOT EXISTS ((SELECT * FROM "Request" EXCEPT SELECT * FROM request_before) UNION (SELECT * FROM request_before EXCEPT SELECT * FROM "Request"));
        END $$;"""
    sql = (
        f'BEGIN; CREATE SCHEMA "{schema}"; SET search_path TO "{schema}";\n'
        + old
        + (fixture if populated else "")
        + last
        + backfill
        + backfill
        + assertions
        + "\nROLLBACK;"
    )
    result = subprocess.run(
        ["psql", url, "-X", "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql,
        text=True,
        capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(result.stderr)
    print(
        "Migration and repeat backfill passed:",
        "historical data" if populated else "empty database",
    )
