# Словарь Метрик ETL (EN -> RU)

Файл относится к `jobs/features_etl.py` и содержит человеко-читаемые русские названия фич.

Важно:
- Технические имена колонок в ETL/CSV остаются английскими.
- Русские названия использовать для отчётов, презентаций, UI-подписей.

## Ключ клиента

| EN | RU |
|---|---|
| customer_id | Идентификатор клиента |

## 30 фич из `features_etl.py`

| # | EN | RU |
|---|---|---|
| 1 | recurrent_buyer | Повторный покупатель |
| 2 | delivery_user | Пользователь доставки |
| 3 | bulk_buyer | Покупатель с крупными покупками |
| 4 | low_cost_buyer | Покупатель с низким средним чеком |
| 5 | prefers_cash | Предпочитает наличные |
| 6 | prefers_card | Предпочитает карту |
| 7 | weekend_shopper | Покупает в выходные |
| 8 | weekday_shopper | Покупает в будни |
| 9 | night_shopper | Ночной покупатель |
| 10 | morning_shopper | Утренний покупатель |
| 11 | no_purchases | Нет покупок |
| 12 | has_purchases_last_7d | Есть покупки за 7 дней |
| 13 | has_purchases_last_14d | Есть покупки за 14 дней |
| 14 | has_purchases_last_30d | Есть покупки за 30 дней |
| 15 | has_purchases_last_90d | Есть покупки за 90 дней |
| 16 | frequent_shopper_last_14d | Частый покупатель за 14 дней |
| 17 | high_ticket_last_90d | Крупный чек за 90 дней |
| 18 | delivery_last_30d | Была доставка за 30 дней |
| 19 | cross_store_shopper_last_90d | Покупал в разных магазинах за 90 дней |
| 20 | mixed_payment_user_last_90d | Использовал смешанную оплату за 90 дней |
| 21 | bought_milk_last_7d | Покупал молочные за 7 дней |
| 22 | bought_milk_last_30d | Покупал молочные за 30 дней |
| 23 | bought_meat_last_7d | Покупал мясо за 7 дней |
| 24 | bought_meat_last_30d | Покупал мясо за 30 дней |
| 25 | bought_fruits_last_30d | Покупал фрукты за 30 дней |
| 26 | bought_vegetables_last_30d | Покупал овощи за 30 дней |
| 27 | bought_bakery_last_30d | Покупал выпечку за 30 дней |
| 28 | bought_organic_last_90d | Покупал органик за 90 дней |
| 29 | high_quantity_buyer_last_30d | Покупал большими объёмами за 30 дней |
| 30 | vegetarian_profile | Вегетарианский профиль |
