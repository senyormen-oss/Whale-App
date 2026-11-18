-- DEMO catalog for presentations. Every row carries the tag 'demo' so it can be removed in one command:
--   delete from public.specialists where 'demo' = any(tags);
-- Ratings and review counts stay at 0 on purpose: no invented reviews.

insert into public.specialists
  (name, category, category_key, city, age, experience, projects, reviews, rating, price, verified, level,
   bio, qualification, avatar, cover, portfolio, tags, available, is_new, approved)
values
  ('Азиза Каримова', 'Photographer', 'photo', 'Ташкент', 27, 6, 0, 0, 0, 350000, true, 'gold',
   'Портреты, семейные и свадебные съёмки. Работаю в естественном свете, фото обрабатываю в течение 3 дней.',
   'Выпускница курсов Canon Academy, 6 лет практики, более 200 съёмок.',
   'https://api.dicebear.com/9.x/initials/svg?seed=Aziza%20Karimova&backgroundColor=0ABAB5', '', '{}',
   array['Портрет','Свадьбы','Семья','demo'], true, true, true),

  ('Бобур Рахимов', 'Videographer', 'video', 'Ташкент', 31, 8, 0, 0, 0, 600000, true, 'platinum',
   'Рекламные ролики, Reels и клипы. Съёмка, монтаж и цветокоррекция под ключ.',
   'Диплом режиссёра монтажа, сертификат DaVinci Resolve, 8 лет в рекламе.',
   'https://api.dicebear.com/9.x/initials/svg?seed=Bobur%20Rahimov&backgroundColor=0ABAB5', '', '{}',
   array['Реклама','Reels','Клипы','demo'], true, true, true),

  ('Дилноза Юсупова', 'Designer', 'design', 'Самарканд', 25, 4, 0, 0, 0, 280000, false, 'silver',
   'Логотипы, фирменный стиль и оформление соцсетей. Сначала эскизы, потом правки до результата.',
   'Окончила факультет дизайна, 4 года работы в студии, Adobe Illustrator и Figma.',
   'https://api.dicebear.com/9.x/initials/svg?seed=Dilnoza%20Yusupova&backgroundColor=0ABAB5', '', '{}',
   array['Логотип','Брендинг','Figma','demo'], true, true, true),

  ('Жасур Тураев', 'Marketer', 'marketer', 'Ташкент', 29, 5, 0, 0, 0, 450000, true, 'gold',
   'Маркетинговая стратегия, воронки и аналитика. Помогаю малому бизнесу получать клиентов из интернета.',
   'Маркетолог с опытом запуска 40+ рекламных кампаний, сертификат Google Ads.',
   'https://api.dicebear.com/9.x/initials/svg?seed=Jasur%20Turaev&backgroundColor=0ABAB5', '', '{}',
   array['Стратегия','Реклама','Аналитика','demo'], true, true, true),

  ('Мадина Алиева', 'Personal Brand', 'brand', 'Ташкент', 33, 7, 0, 0, 0, 500000, true, 'platinum',
   'Личный бренд для экспертов и предпринимателей: позиционирование, контент-план, образ и выступления.',
   'Консультант по личному бренду, 7 лет практики, автор курса по экспертному блогу.',
   'https://api.dicebear.com/9.x/initials/svg?seed=Madina%20Aliyeva&backgroundColor=0ABAB5', '', '{}',
   array['Личный бренд','Эксперты','Контент','demo'], true, true, true),

  ('Санжар Умаров', 'SMM', 'smm', 'Бухара', 24, 3, 0, 0, 0, 220000, false, 'bronze',
   'Ведение Instagram и Telegram: контент, сторис, общение с аудиторией и ежемесячный отчёт.',
   'Прошёл курс SMM-менеджера, 3 года ведёт аккаунты кафе и магазинов.',
   'https://api.dicebear.com/9.x/initials/svg?seed=Sanjar%20Umarov&backgroundColor=0ABAB5', '', '{}',
   array['Instagram','Telegram','Контент','demo'], true, true, true);
