-- Remove only the explicitly authorized disposable retest account; preserve all existing players.
-- Resolve the generated user ID through its unique fixture name and synthetic email.
delete from auth.refresh_tokens where user_id in (select u.id::text from auth.users u join private.accounts a on a.user_id=u.id where a.game_key='sec_retest_1024221115' and u.email='267b9a919d1564f8ae958ae1ee5f39b8fe3c31e7535f3ce4a31e335d0d3965cc@players.invalid' and not exists(select 1 from private.admins m where m.user_id=u.id));
delete from auth.users u using private.accounts a where a.user_id=u.id and a.game_key='sec_retest_1024221115' and u.email='267b9a919d1564f8ae958ae1ee5f39b8fe3c31e7535f3ce4a31e335d0d3965cc@players.invalid' and not exists(select 1 from private.admins m where m.user_id=u.id);
delete from private.rate_limits where key in ('register:id:sec_retest_1024221115','login:id:sec_retest_1024221115');
