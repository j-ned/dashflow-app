-- Données SYNTHÉTIQUES du test de charge (aucune donnée réelle) : :users comptes vérifiés,
-- tous avec le même hash Argon2 (:hash, calculé par l'image de l'API), et pour chacun des volumes
-- d'un utilisateur actif. Les champs métier sont dans des blobs `encrypted_data` factices, comme
-- en production où l'API ne voit que du chiffré.
--   psql -v users=200 -v hash="'<hash argon2>'" -f seed.sql
\set ON_ERROR_STOP on

begin;

insert into users (email, password, email_verified, encryption_version)
select format('load+%s@example.test', n), :hash, now(), 1
from generate_series(1, :users) as n;

create temporary table load_users on commit drop as
  select id from users where email like 'load+%@example.test';

-- Blob de la taille d'un enregistrement chiffré réel (~400 caractères) ; son contenu est sans
-- importance, l'API ne le lit pas.
create temporary table blob on commit drop as
  select repeat(md5('dashflow-load'), 13) as v;

insert into bank_accounts (user_id, name, encrypted_data)
select u.id, 'chiffré', (select v from blob)
from load_users u, generate_series(1, 5);

insert into account_transactions (user_id, account_id, amount, direction, date, encrypted_data)
select a.user_id, a.id, 0, 'expense', current_date - (n % 365), (select v from blob)
from bank_accounts a, generate_series(1, 60) as n
where a.user_id in (select id from load_users);

insert into envelopes (user_id, name, type, encrypted_data)
select u.id, 'chiffré', 'épargne', (select v from blob)
from load_users u, generate_series(1, 10);

insert into patients (user_id, first_name, last_name, encrypted_data)
select u.id, 'chiffré', 'chiffré', (select v from blob)
from load_users u, generate_series(1, 3);

insert into practitioners (user_id, name, type, encrypted_data)
select u.id, 'chiffré', 'generaliste', (select v from blob)
from load_users u, generate_series(1, 3);

insert into appointments (user_id, patient_id, practitioner_id, date, time, encrypted_data)
select p.user_id, p.id, pr.id, current_date + (n % 90), '09:00', (select v from blob)
from patients p
join practitioners pr on pr.user_id = p.user_id
cross join generate_series(1, 2) as n
where p.user_id in (select id from load_users);

commit;

analyze;

select 'users' as table_name, count(*) from users
union all select 'bank_accounts', count(*) from bank_accounts
union all select 'account_transactions', count(*) from account_transactions
union all select 'envelopes', count(*) from envelopes
union all select 'patients', count(*) from patients
union all select 'appointments', count(*) from appointments;
