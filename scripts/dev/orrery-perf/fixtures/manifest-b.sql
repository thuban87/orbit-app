-- Later session: one Size 5 membership row gone, satellites off, ring_seq of Aiden/Bianca swapped
-- (and Adele's photo bytes differ, see manifest-photos.json).
INSERT INTO contacts VALUES (1,'c1','Aiden Ashworth',7,1,0,'2026-10-01 09:00:00',NULL,NULL,1,'2026-10-04 12:00:00');
INSERT INTO contacts VALUES (2,'c2','Bianca Bellamy',30,1,0,'2026-09-07 09:00:00',NULL,'avatars/contact-2.jpg',0,'2026-10-04 12:00:00');
INSERT INTO contacts VALUES (3,'c3','Emeka Esposito',60,1,0,NULL,NULL,NULL,NULL,'2026-10-04 12:00:00');
INSERT INTO contacts VALUES (4,'c4','Adele Abbott',14,1,0,'2026-09-24 09:00:00',NULL,'avatars/contact-4.jpg',2,'2026-10-04 12:00:00');
INSERT INTO contacts VALUES (5,'c5','Bram Abbott',21,1,1,'2026-08-25 09:00:00',NULL,NULL,3,'2026-10-04 12:00:00');
INSERT INTO contacts VALUES (6,'c6','Phone Resident',14,1,0,'2026-09-30 10:00:00',NULL,NULL,4,'2026-01-01 00:00:00');
INSERT INTO systems VALUES (1,'u120','Size 120'),(2,'u5','Size 5'),(3,'ust','Orrery Stress');
INSERT INTO system_overrides (system_ref, contact_id, mode) VALUES
  ('custom:u120',1,'include'),('custom:u120',2,'include'),('custom:u120',3,'include'),
  ('custom:u5',1,'include'),
  ('custom:ust',4,'include'),('custom:ust',5,'include');
INSERT INTO app_settings VALUES (1,'balanced',0,'custom:u120',NULL);
