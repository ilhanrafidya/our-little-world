-- Data contoh (opsional) untuk mengetes globe & peta sebelum ada kenangan asli.
-- Hapus kapan saja:  DELETE FROM memories WHERE story LIKE '[seed]%';

INSERT INTO memories (title, city, country, lat, lng, status, memory_date, story) VALUES
  ('Kopi Kenangan pertama',  'Depok',      'Indonesia', -6.3622, 106.8240, 'visited',  '2024-02-14', '[seed] Tempat ngobrol pertama kali.'),
  ('Stasiun UI',             'Depok',      'Indonesia', -6.3608, 106.8317, 'visited',  '2024-03-01', '[seed] Nunggu KRL bareng.'),
  ('Braga Night Walk',       'Bandung',    'Indonesia', -6.9175, 107.6097, 'visited',  '2024-06-22', '[seed] Jalan malam di Braga.'),
  ('Malioboro',              'Yogyakarta', 'Indonesia', -7.7926, 110.3658, 'visited',  '2024-12-28', '[seed] Liburan akhir tahun.'),
  ('Shibuya Crossing',       'Tokyo',      'Japan',     35.6595, 139.7005, 'wishlist', NULL,         '[seed] Suatu hari nanti!');
