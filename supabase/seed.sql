-- Whale — seed data. Run after schema.sql.
-- Populates the public specialist catalog so the app has real data to read from Supabase.

insert into public.specialists
  (id, name, category, category_key, city, age, experience, projects, reviews, rating, price, verified, level, bio, avatar, cover, portfolio, tags, available, is_new)
values
  ('s1', 'Aziz Karimov', 'Videographer', 'video', 'Tashkent', 28, 5, 127, 84, 4.9, 350000, true, 'gold',
   'Commercial and cinematic videographer specializing in brand films and social media content. Worked with 50+ local and international brands. Canon R5 + DJI Ronin setup.',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1551817958-c5b51e7b4a33?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1587440871875-191322ee64b0?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1601506521793-dc748fc80b67?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&h=300&fit=crop&auto=format'
   ],
   array['Commercial', 'Reels', 'Brand Films', 'Color Grading', 'Drone'],
   true, false),

  ('s2', 'Malika Yusupova', 'Photographer', 'photo', 'Tashkent', 25, 4, 89, 61, 4.8, 280000, true, 'silver',
   'Fashion and lifestyle photographer with editorial experience. Published in Vogue UA and local fashion magazines. Sony A7IV shooter.',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop&auto=format'
   ],
   array['Fashion', 'Portrait', 'Editorial', 'Studio', 'Lifestyle'],
   true, false),

  ('s3', 'Jasur Toshmatov', 'SMM Specialist', 'smm', 'Tashkent', 27, 6, 214, 147, 4.7, 200000, true, 'platinum',
   'Full-stack SMM strategist managing 30+ brand accounts. Grew accounts from 0 to 100K+ followers. Certified Meta Business Partner.',
   'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=400&h=300&fit=crop&auto=format'
   ],
   array['Instagram', 'TikTok', 'Strategy', 'Analytics', 'Ads'],
   true, false),

  ('s4', 'Nilufar Rashidova', 'Model', 'model', 'Tashkent', 23, 3, 56, 38, 5.0, 400000, true, 'gold',
   'Commercial and fashion model working with top brands. Experience in photo, video, and runway shows. Collaborated with Zara, H&M, and local luxury brands.',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1496440543098-6dc01f6d40d2?w=400&h=300&fit=crop&auto=format'
   ],
   array['Commercial', 'Fashion', 'Runway', 'Beauty', 'Lifestyle'],
   false, false),

  ('s5', 'Bobur Saidov', 'Mobilographer', 'mobile', 'Samarkand', 22, 2, 43, 29, 4.6, 180000, false, 'bronze',
   'iPhone cinematography specialist. Creates cinematic content with just a smartphone. Viral Reels creator with 2M+ views total.',
   'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=300&fit=crop&auto=format'
   ],
   array['iPhone', 'Reels', 'Cinematic', 'TikTok', 'Viral'],
   true, true),

  ('s6', 'Dildora Mirzayeva', 'Content Creator', 'content', 'Tashkent', 26, 4, 178, 112, 4.8, 150000, true, 'gold',
   'Creative content strategist producing viral content for brands. Specializes in storytelling, scripts, and visual concepts for Reels and TikTok.',
   'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=400&h=300&fit=crop&auto=format'
   ],
   array['Scripts', 'Reels', 'TikTok', 'Storytelling', 'Strategy'],
   true, true),

  ('s7', 'Ulugbek Nazarov', 'Programmer', 'prog', 'Tashkent', 30, 8, 312, 201, 4.9, 500000, true, 'platinum',
   'Full-stack developer specializing in React, Node.js, and mobile apps. Built 50+ production apps. AWS certified architect.',
   'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=300&fit=crop&auto=format'
   ],
   array['React', 'Node.js', 'Mobile', 'AWS', 'TypeScript'],
   true, false),

  ('s8', 'Feruza Ismoilova', 'Designer', 'design', 'Bukhara', 24, 3, 95, 67, 4.7, 250000, true, 'silver',
   'Brand identity and UI/UX designer. Creates stunning visual identities and digital products. Figma expert with 95+ satisfied clients.',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1508921340878-ba53e1f016ec?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=300&fit=crop&auto=format'
   ],
   array['Branding', 'UI/UX', 'Figma', 'Motion', 'Print'],
   true, true),

  ('s9', 'Zulfiya Abdullayeva', 'Targetologist', 'target', 'Tashkent', 29, 5, 143, 98, 4.6, 220000, true, 'gold',
   'Performance marketing specialist with $2M+ in managed ad spend. Meta and Google Ads certified. Average ROAS 4.2x for e-commerce clients.',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop&auto=format'
   ],
   array['Meta Ads', 'Google Ads', 'ROAS', 'E-commerce', 'Retargeting'],
   true, false),

  ('s10', 'Sardor Xolmatov', 'Blogger', 'blogger', 'Tashkent', 26, 4, 67, 45, 4.5, 300000, false, 'silver',
   '500K+ followers across Instagram and TikTok. Lifestyle and tech niche. Brand integrations with 40+ companies. Authentic storytelling approach.',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&auto=format',
   'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&h=400&fit=crop&auto=format',
   array[
     'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=400&h=300&fit=crop&auto=format',
     'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=300&fit=crop&auto=format'
   ],
   array['Lifestyle', 'Tech', 'Instagram', 'TikTok', 'Integrations'],
   true, true)
on conflict (id) do update set
  name = excluded.name, category = excluded.category, category_key = excluded.category_key,
  city = excluded.city, age = excluded.age, experience = excluded.experience,
  projects = excluded.projects, reviews = excluded.reviews, rating = excluded.rating,
  price = excluded.price, verified = excluded.verified, level = excluded.level,
  bio = excluded.bio, avatar = excluded.avatar, cover = excluded.cover,
  portfolio = excluded.portfolio, tags = excluded.tags,
  available = excluded.available, is_new = excluded.is_new;

insert into public.reviews (specialist_id, author_name, author_avatar, rating, quality, timing, communication, text)
values
  ('s1', 'Sherzod Mirzayev', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format', 5, 5, 5, 5,
   'Aziz delivered outstanding results for our brand campaign. The cinematic quality exceeded our expectations. Will definitely book again.'),
  ('s1', 'Kamola Usmonova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format', 5, 5, 5, 4,
   'Professional, creative, and punctual. The Reels he created got 200K+ views. Highly recommend for any brand content.'),
  ('s1', 'Nodir Kalandarov', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=80&h=80&fit=crop&auto=format', 4, 5, 4, 5,
   'Great work overall. Communication was smooth and the final edit looked premium. Minor timing delay but worth the quality.')
on conflict do nothing;
