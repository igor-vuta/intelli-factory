-- Broad starting taxonomy: 20 groups following the chapter structure of the Harmonized System
-- (the basis of ТН ВЭД ЕАЭС), with short labels written for this platform in EN/RU/KK and an
-- "Other (not listed)" category in every group for products that fit nowhere yet. Chapters 36
-- (explosives) and 93 (arms) are left out. IDs are deterministic; rows that already exist by
-- slug are left untouched, and the five original categories move under their matching group.
INSERT INTO "Category" ("id", "slug", "default_name", "parent_id", "status", "source_locale", "record_state", "updated_at") VALUES
 ('18dd93c2-3caa-570a-9500-b7373129291b', 'hs-section-01', 'Live animals and animal products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7ca789e4-8027-54f6-818f-c31d11bbf353', 'hs-01', 'Live animals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('0a01f341-dc22-5c83-9941-7b2654e6a3ac', 'hs-02', 'Meat and offal', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6aa73f5b-4c21-5118-af7c-6b7bed2c9a64', 'hs-03', 'Fish and seafood', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('a38279ea-715d-5a78-8e6f-eba3b9809e6c', 'hs-04', 'Dairy, eggs and honey', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('da849c2e-146e-54f9-a21b-d4383905e47f', 'hs-05', 'Other animal products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e2b947eb-b915-586a-80cc-aa08f58b659d', 'other-01', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4ebe6b3d-c352-57b3-85b1-d868bf3a9ad2', 'hs-section-02', 'Vegetable products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('af1db170-bd19-554b-950b-0998f509ef6c', 'hs-06', 'Plants and cut flowers', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('5164dca5-9902-5691-9735-3c6fddc42cdf', 'hs-07', 'Vegetables', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f281ffe2-4449-54ef-9771-d5656bd9ae6a', 'hs-08', 'Fruit and nuts', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('b492eb6a-3ed8-580d-a2ee-01da115c2fb3', 'hs-09', 'Coffee, tea and spices', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('505154ce-0d62-557c-9aca-2f7e0e74fb0b', 'hs-10', 'Cereals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4b015538-3ad5-510e-a72f-4f79e7d9cd62', 'hs-11', 'Flour, malt and starch', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6ca8da0b-d427-58a6-8e82-8a65359fc56a', 'hs-12', 'Oil seeds and fodder', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4ad262ae-4193-5e2d-8c53-251ff36a34ea', 'hs-13', 'Gums, resins and plant extracts', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('83092cff-4267-59d6-9793-5357724394f0', 'hs-14', 'Plant materials for weaving', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('dcd8279f-185e-5cc9-8740-fcc4fcbda850', 'other-02', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3da48bb2-7dec-5ca3-8675-71ef53c215d6', 'hs-section-03', 'Fats and oils', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('0c7b6230-4198-5881-9e7f-3cb1ff5c3236', 'hs-15', 'Animal and vegetable fats and oils', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f7079873-0be2-5bae-8730-b7169b94afa4', 'other-03', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('a1dcc3c7-f562-5ada-aec6-6e7cf507ffd6', 'hs-section-04', 'Prepared food, beverages and tobacco', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('1adf87d1-0390-59e4-b2d4-bf0a952e75d5', 'hs-16', 'Meat and fish products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3f3c1d12-5875-5ba9-b1bb-626fb62be2c2', 'hs-17', 'Sugar and sugar confectionery', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('16fa53d5-6a18-5aec-b57e-9e186f3daecf', 'hs-18', 'Cocoa and chocolate', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('76c5e890-417d-5f63-8639-b8e2375b9b95', 'hs-19', 'Bakery, pasta and cereal products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7b0a1754-19d2-5a52-a2a3-715e9339fb87', 'hs-20', 'Preserved vegetables and fruit', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7926eb28-f1db-5600-b2f2-598566925184', 'hs-21', 'Other food products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('53b75950-15de-542d-958e-a3ee95b193d8', 'hs-22', 'Beverages and vinegar', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('aff86272-2128-5231-a28d-9197b73af874', 'hs-23', 'Food industry residues and animal feed', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e97e9500-9d2f-55c0-a4f6-30ce16ef4aa8', 'hs-24', 'Tobacco', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('46e68e93-02f1-5e64-881c-3c54b2254952', 'other-04', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('d3498f13-6cda-55a8-8ea5-a660caeaa8fd', 'hs-section-05', 'Mineral products and fuels', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('364500ba-2932-531b-9fca-16171e8bc686', 'hs-25', 'Salt, sulphur, stone and cement', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('df401402-6e83-5dc2-8a73-420b7b97bad2', 'hs-26', 'Ores, slag and ash', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('71bffd8e-c76d-5d84-a951-e2c30a3a4bf1', 'hs-27', 'Mineral fuels and oil products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7e76f320-c628-589b-90ae-8acf0c29a5b8', 'other-05', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('fbf31481-4801-5458-b761-2aaa02b19a20', 'hs-section-06', 'Chemicals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3138d2dd-1a12-52bc-a07d-aed658e9d53f', 'hs-28', 'Inorganic chemicals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('b03ec15c-20c6-5b26-9cb7-177393619060', 'hs-29', 'Organic chemicals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7dd2a7d1-5789-5945-bd38-c80973303403', 'hs-30', 'Pharmaceuticals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6c01c590-9732-5ea7-bb5f-55e2a14c2e1b', 'hs-31', 'Fertilisers', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('d77903a8-f8ed-5f7c-884d-94c0bcf9ac4d', 'hs-32', 'Paints, dyes and inks', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('318c1423-19d9-5b2a-b284-9a6af473f9d1', 'hs-33', 'Essential oils and cosmetics', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('148ca7ec-9c46-5c98-a54a-b6f9b0987ebc', 'hs-34', 'Soap, detergents and waxes', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f08b48aa-72c2-5116-92b8-72f197d0d03e', 'hs-35', 'Proteins, glues and enzymes', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f36795af-08e1-57b2-b54b-8499ff824173', 'hs-37', 'Photographic and film goods', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('65dbcba6-52a0-5a10-9afb-dccbda38eb34', 'hs-38', 'Other chemical products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e243458e-2194-534e-b185-ec4f07d4ee80', 'other-06', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f5fcd1ee-af3e-547d-b6bb-698dc0d0e5de', 'hs-section-07', 'Plastics and rubber', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('998169bc-080b-5319-ad67-6e2b128e8658', 'hs-39', 'Plastics and plastic products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('c253756e-317e-5d28-b862-3a57b495c6d0', 'hs-40', 'Rubber and rubber products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3edbd856-0dd9-5438-82de-223309c4b454', 'other-07', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7748b111-1363-52f2-b5e6-66f02a77ac98', 'hs-section-08', 'Leather and fur', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('0947100b-cf74-5c2b-ab6e-205b98f8b449', 'hs-41', 'Raw hides and leather', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6d5b12cb-2a31-5567-b8a1-9c8d1500d8b6', 'hs-42', 'Leather goods and bags', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6a4392b3-4579-59f7-95be-35b14f72bf7d', 'hs-43', 'Natural and artificial fur', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('76b5f8f8-f8f3-59d3-a09f-5fcf04253306', 'other-08', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('bcaf458c-172d-5f5c-9bb8-0fa8548086d5', 'hs-section-09', 'Wood, cork and wickerwork', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f8567d1a-8614-5dbf-9809-fe3e5ceec063', 'hs-44', 'Wood and wood products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3913a20d-aebd-5803-b448-3ed31804748c', 'hs-45', 'Cork', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('b675f932-3704-5c83-aed5-da294aafc8e7', 'hs-46', 'Basketware and wickerwork', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('0f479d4d-6bf4-5056-adb9-2a5985953223', 'other-09', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('dd0faf43-52ee-57b9-8b3a-4d49fc1477ce', 'hs-section-10', 'Paper, packaging and printed products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4483c826-777a-57d0-b49a-57ecc458455d', 'hs-47', 'Pulp and waste paper', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('2ddca3c9-0caa-504e-961f-c06c796e6b5e', 'hs-48', 'Paper and paperboard', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6bd0a3b6-e101-5a7e-90ab-3e78883c2248', 'hs-49', 'Printed products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('cb4dde82-d844-5f6f-8ebf-e889fd0c83c2', 'other-10', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('c2e41b3d-c485-555e-9ed5-ad75a844cbe2', 'hs-section-11', 'Textiles and clothing', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('5c415c6c-b79a-50b9-9c67-09a2c8f49ecb', 'hs-50', 'Silk', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('c8da8bc0-d513-5fbb-a4b5-95b547039d51', 'hs-51', 'Wool and animal hair', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('274442c9-6ce8-5f1a-b91e-f359263767aa', 'hs-52', 'Cotton', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7cd87f57-94fc-5223-bdc5-13a4c0524f58', 'hs-53', 'Other plant fibres', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('59706800-1ff5-572a-b1a3-d2d9112e7ac9', 'hs-54', 'Synthetic and artificial filaments', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('66d3f741-b181-5c69-957c-8d27dd365fbc', 'hs-55', 'Synthetic and artificial staple fibres', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4c4ac279-13f3-5790-a046-4d4a3e15cb80', 'hs-56', 'Wadding, felt, nonwovens and rope', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6eb6d260-21f7-5c62-b3fa-f4f983f9a9a6', 'hs-57', 'Carpets and floor coverings', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('bcf7f6f9-8f76-5d48-a783-2f3dbf5980ea', 'hs-58', 'Special fabrics and lace', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('b4899207-9a49-5e36-a023-1c2a61206eee', 'hs-59', 'Coated and technical textiles', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('16497759-9a37-57cd-9d41-c79d5380f71e', 'hs-60', 'Knitted fabrics', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('169e66f2-f220-5aa1-a6d4-fe3125fc0c90', 'hs-61', 'Knitted clothing', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('01d701f9-664d-5e2c-8b19-a142427cba11', 'hs-62', 'Woven clothing', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e46d4809-6de3-5284-b99d-11aee74d7799', 'hs-63', 'Home textiles and used clothing', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('72847369-706a-54a3-93c9-72c849ab7c3a', 'other-11', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('36807a61-a4b7-5118-aad3-a78cc0abcf2d', 'hs-section-12', 'Footwear, headgear and umbrellas', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('30dbeeec-58ea-5735-b92e-e0dcb474eefd', 'hs-64', 'Footwear', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('2ee6b49e-c7a5-5fd9-8190-58cb88ef6253', 'hs-65', 'Headgear', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4e5b010b-bfb9-540d-b682-3e1702e299df', 'hs-66', 'Umbrellas and walking sticks', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('918c4ae3-328a-5aea-b4cc-dcf2453170c7', 'hs-67', 'Feathers and artificial flowers', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f79d05cf-1989-5de2-81eb-253581b31b7e', 'other-12', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('db5d50ef-6499-5a38-9b0c-f8a4759c0ece', 'hs-section-13', 'Stone, ceramics and glass', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('2192dc4c-91a5-5274-bd0a-d802a9f9967d', 'hs-68', 'Stone, plaster and cement articles', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('da91552a-2639-5d3a-95fb-3df2ac9ccc7b', 'hs-69', 'Ceramic products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('c5414d0d-b3eb-5a6b-bcbd-bdfccd5a3ce6', 'hs-70', 'Glass and glassware', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('cf83d01c-c31c-5af6-9aca-ccabe37d45d2', 'other-13', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('71691104-9fd3-5a3f-88f4-fbe34fdfa24e', 'hs-section-14', 'Precious metals and jewellery', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7cc6ff64-7456-5f8d-823c-8c809a259a0e', 'hs-71', 'Precious metals, stones and jewellery', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('49bc07d4-2dc1-56a9-bf3f-ca0920abd3d5', 'other-14', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e7e2016c-792b-5821-8ecb-24391c818917', 'hs-section-15', 'Base metals and metal products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('a71c6874-aa50-5ba6-9594-35698ffc0dca', 'hs-72', 'Iron and steel', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('803ce72a-93a7-5be0-82e7-0bfe142b8dd8', 'hs-73', 'Iron and steel products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('dbe36952-6bfa-56e4-b6e0-c9e59767ff82', 'hs-74', 'Copper and copper products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('84e9e5fe-52e0-55fb-a198-3b6d740e38e3', 'hs-75', 'Nickel and nickel products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('8a5a1ec7-e192-5653-9cab-a2e259913294', 'hs-76', 'Aluminium and aluminium products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('053a3f84-b97d-5308-a45c-a8b9959b215d', 'hs-78', 'Lead and lead products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3a485ac4-cc19-5da0-8d6a-37f0f0ec94c5', 'hs-79', 'Zinc and zinc products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e0c5ae92-d3ca-5964-a0f7-3ea68ae94290', 'hs-80', 'Tin and tin products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('fe87c5fe-ac2b-5e64-97ba-1a57f3e0db28', 'hs-81', 'Other base metals', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('a180c97e-cb4a-5b0d-a11b-37462023655a', 'hs-82', 'Tools and cutlery', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e90b3a5f-2787-5014-99d8-0d254a62a909', 'hs-83', 'Other metal products', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('ceb4cca7-3a5e-56d7-a991-9d45f643b712', 'other-15', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('c616debc-0fcf-5dea-bb30-c753f2f073ec', 'hs-section-16', 'Machinery and electrical equipment', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('b8261504-a28e-54de-84ad-b354e7f95a3b', 'hs-84', 'Machinery and mechanical equipment', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e5853628-3957-54bc-ae3d-58a8c9e21ac7', 'hs-85', 'Electrical equipment and electronics', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('446d5f04-e9ac-527e-8804-3c0ae8bc20ea', 'other-16', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('6427489a-44fb-5d47-94b8-9ad7622d9404', 'hs-section-17', 'Vehicles and transport equipment', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('92e07b7d-1e59-5e4b-8ce9-f691b4cc39b4', 'hs-86', 'Railway vehicles and equipment', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('cf02f8b2-0caf-5129-95eb-54fd1f79143e', 'hs-87', 'Motor vehicles and parts', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f912c261-0e25-5d92-950d-8c49147bc3b9', 'hs-88', 'Aircraft and spacecraft', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('39e86194-10a8-5279-ae67-817903bee5a6', 'hs-89', 'Ships and boats', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('9eb2d3ce-bd66-51c5-97b3-7129793aeb13', 'other-17', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('f8de3fd8-8122-51fc-938a-b3813fe6e34c', 'hs-section-18', 'Instruments, medical equipment and clocks', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('3a8c02a4-7864-5924-8922-25573288b305', 'hs-90', 'Optical, measuring and medical instruments', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('447ea22e-84a5-586a-98bc-4015214e437c', 'hs-91', 'Clocks and watches', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('03f82c5a-9544-5d5f-b1f8-e669f98dfe07', 'hs-92', 'Musical instruments', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('ed2a496b-8f97-5234-861c-6ee991ff7d43', 'other-18', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('e37f2e7c-a01a-56c6-bcea-ac4dc95a6cce', 'hs-section-20', 'Furniture, toys and other manufactured goods', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('9ba7720b-c5a5-5e49-ba16-8191c93d32e2', 'hs-94', 'Furniture, bedding and lighting', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('4c658505-4263-5591-89e8-bffc5a365329', 'hs-95', 'Toys, games and sports equipment', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('7a65b186-7323-5dec-ac93-7e3a31410cfd', 'hs-96', 'Other manufactured articles', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('1391cb5a-ab57-5d75-8819-7a6235bf10ed', 'other-20', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('0b6f1d7f-d8b7-590f-a634-ef53704bf54e', 'hs-section-21', 'Art and antiques', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('9c2afc8b-5723-5d1a-8b82-17c0452803f4', 'hs-97', 'Works of art and antiques', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP),
 ('1e1dd914-930b-55f8-bef7-3f0c3adcb2b0', 'other-21', 'Other (not listed)', NULL, 'ACTIVE', 'en', 'ESTABLISHED', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
-- Parents are set after every group exists.
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-01') WHERE "slug" = 'hs-01' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-01') WHERE "slug" = 'hs-02' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-01') WHERE "slug" = 'hs-03' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-01') WHERE "slug" = 'hs-04' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-01') WHERE "slug" = 'hs-05' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-01') WHERE "slug" = 'other-01' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-06' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-07' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-08' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-09' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-10' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-11' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-12' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-13' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'hs-14' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-02') WHERE "slug" = 'other-02' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-03') WHERE "slug" = 'hs-15' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-03') WHERE "slug" = 'other-03' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-16' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-17' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-18' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-19' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-20' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-21' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-22' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-23' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'hs-24' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'other-04' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-05') WHERE "slug" = 'hs-25' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-05') WHERE "slug" = 'hs-26' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-05') WHERE "slug" = 'hs-27' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-05') WHERE "slug" = 'other-05' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-28' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-29' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-30' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-31' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-32' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-33' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-34' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-35' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-37' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'hs-38' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-06') WHERE "slug" = 'other-06' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-07') WHERE "slug" = 'hs-39' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-07') WHERE "slug" = 'hs-40' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-07') WHERE "slug" = 'other-07' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-08') WHERE "slug" = 'hs-41' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-08') WHERE "slug" = 'hs-42' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-08') WHERE "slug" = 'hs-43' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-08') WHERE "slug" = 'other-08' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-09') WHERE "slug" = 'hs-44' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-09') WHERE "slug" = 'hs-45' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-09') WHERE "slug" = 'hs-46' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-09') WHERE "slug" = 'other-09' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-10') WHERE "slug" = 'hs-47' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-10') WHERE "slug" = 'hs-48' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-10') WHERE "slug" = 'hs-49' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-10') WHERE "slug" = 'other-10' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-50' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-51' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-52' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-53' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-54' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-55' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-56' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-57' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-58' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-59' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-60' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-61' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-62' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'hs-63' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'other-11' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-12') WHERE "slug" = 'hs-64' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-12') WHERE "slug" = 'hs-65' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-12') WHERE "slug" = 'hs-66' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-12') WHERE "slug" = 'hs-67' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-12') WHERE "slug" = 'other-12' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-13') WHERE "slug" = 'hs-68' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-13') WHERE "slug" = 'hs-69' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-13') WHERE "slug" = 'hs-70' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-13') WHERE "slug" = 'other-13' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-14') WHERE "slug" = 'hs-71' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-14') WHERE "slug" = 'other-14' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-72' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-73' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-74' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-75' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-76' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-78' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-79' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-80' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-81' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-82' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'hs-83' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-15') WHERE "slug" = 'other-15' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-16') WHERE "slug" = 'hs-84' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-16') WHERE "slug" = 'hs-85' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-16') WHERE "slug" = 'other-16' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-17') WHERE "slug" = 'hs-86' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-17') WHERE "slug" = 'hs-87' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-17') WHERE "slug" = 'hs-88' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-17') WHERE "slug" = 'hs-89' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-17') WHERE "slug" = 'other-17' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-18') WHERE "slug" = 'hs-90' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-18') WHERE "slug" = 'hs-91' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-18') WHERE "slug" = 'hs-92' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-18') WHERE "slug" = 'other-18' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-20') WHERE "slug" = 'hs-94' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-20') WHERE "slug" = 'hs-95' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-20') WHERE "slug" = 'hs-96' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-20') WHERE "slug" = 'other-20' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-21') WHERE "slug" = 'hs-97' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-21') WHERE "slug" = 'other-21' AND "parent_id" IS NULL;
INSERT INTO "CategoryTranslation" ("id", "category_id", "locale", "name")
SELECT 'a30bd71b-2a0f-5e11-9281-af38d839418e'::uuid, "id", 'ru', 'Живые животные и продукция животного происхождения' FROM "Category" WHERE "slug" = 'hs-section-01'
UNION ALL SELECT '0d5c22b0-ca32-57de-a526-4b59e40c5333'::uuid, "id", 'kk', 'Тірі жануарлар және жануардан алынатын өнімдер' FROM "Category" WHERE "slug" = 'hs-section-01'
UNION ALL SELECT '726f590d-e94d-5a1c-b2a7-0db020553522'::uuid, "id", 'ru', 'Живые животные' FROM "Category" WHERE "slug" = 'hs-01'
UNION ALL SELECT 'cd7da5a3-6f92-5d82-8ad2-3500a656b71b'::uuid, "id", 'kk', 'Тірі жануарлар' FROM "Category" WHERE "slug" = 'hs-01'
UNION ALL SELECT '20988f47-187d-59ca-bfe1-cec8ae51b897'::uuid, "id", 'ru', 'Мясо и субпродукты' FROM "Category" WHERE "slug" = 'hs-02'
UNION ALL SELECT '379a9ca1-c4da-5994-8153-ed7b3ffc8b5c'::uuid, "id", 'kk', 'Ет және ет өнімдері' FROM "Category" WHERE "slug" = 'hs-02'
UNION ALL SELECT '22f71722-e1ba-53f4-a57c-5b3505a3c25e'::uuid, "id", 'ru', 'Рыба и морепродукты' FROM "Category" WHERE "slug" = 'hs-03'
UNION ALL SELECT 'c2fb16d1-5605-515e-b1db-16d382092698'::uuid, "id", 'kk', 'Балық және теңіз өнімдері' FROM "Category" WHERE "slug" = 'hs-03'
UNION ALL SELECT '75d4712d-b67d-541c-93fe-d57775ae5110'::uuid, "id", 'ru', 'Молочная продукция, яйца и мёд' FROM "Category" WHERE "slug" = 'hs-04'
UNION ALL SELECT 'bc414fbd-c8f8-5ca9-b165-df62974822a0'::uuid, "id", 'kk', 'Сүт өнімдері, жұмыртқа және бал' FROM "Category" WHERE "slug" = 'hs-04'
UNION ALL SELECT '2711dae7-5db2-59c4-a51f-e80d29324e63'::uuid, "id", 'ru', 'Прочие продукты животного происхождения' FROM "Category" WHERE "slug" = 'hs-05'
UNION ALL SELECT '9e0e70a6-5e30-524d-a6b6-1bf2095544aa'::uuid, "id", 'kk', 'Жануардан алынатын басқа өнімдер' FROM "Category" WHERE "slug" = 'hs-05'
UNION ALL SELECT '53e9b00d-073f-5db6-980c-cd6d595e0899'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-01'
UNION ALL SELECT '44e26d2d-f114-5d50-86b7-0fc301d7f0a7'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-01'
UNION ALL SELECT '709fe78d-521a-500c-a698-f87e003997c3'::uuid, "id", 'ru', 'Продукты растительного происхождения' FROM "Category" WHERE "slug" = 'hs-section-02'
UNION ALL SELECT '03690ac6-4d52-51e2-9ae0-486a9b049168'::uuid, "id", 'kk', 'Өсімдік өнімдері' FROM "Category" WHERE "slug" = 'hs-section-02'
UNION ALL SELECT 'be05e9f1-7f50-527f-a359-0de46b25f195'::uuid, "id", 'ru', 'Живые растения и срезанные цветы' FROM "Category" WHERE "slug" = 'hs-06'
UNION ALL SELECT '926d475e-7b8e-53a9-8bec-6be4e067fce3'::uuid, "id", 'kk', 'Тірі өсімдіктер және кесілген гүлдер' FROM "Category" WHERE "slug" = 'hs-06'
UNION ALL SELECT 'af6d823f-1689-562d-82ec-cd33853e962b'::uuid, "id", 'ru', 'Овощи' FROM "Category" WHERE "slug" = 'hs-07'
UNION ALL SELECT '3bd4bd35-29a7-59b7-9e68-e9a293f0b788'::uuid, "id", 'kk', 'Көкөністер' FROM "Category" WHERE "slug" = 'hs-07'
UNION ALL SELECT 'd9102077-a5bd-5505-a83e-6cb9dcb77729'::uuid, "id", 'ru', 'Фрукты и орехи' FROM "Category" WHERE "slug" = 'hs-08'
UNION ALL SELECT 'b4f7214e-a5b5-5465-87c9-c8b3dbbd7f84'::uuid, "id", 'kk', 'Жемістер мен жаңғақтар' FROM "Category" WHERE "slug" = 'hs-08'
UNION ALL SELECT 'd1b027e1-8a5b-5b24-b0db-e6c082edc2e6'::uuid, "id", 'ru', 'Кофе, чай и пряности' FROM "Category" WHERE "slug" = 'hs-09'
UNION ALL SELECT 'eb007fac-0c89-5697-b22d-11ba4cc8cb00'::uuid, "id", 'kk', 'Кофе, шай және дәмдеуіштер' FROM "Category" WHERE "slug" = 'hs-09'
UNION ALL SELECT '52911b3e-3558-5122-ba10-02cb80df9107'::uuid, "id", 'ru', 'Зерновые' FROM "Category" WHERE "slug" = 'hs-10'
UNION ALL SELECT '5dd82ffc-820c-5d63-b42e-4a36d408d700'::uuid, "id", 'kk', 'Дәнді дақылдар' FROM "Category" WHERE "slug" = 'hs-10'
UNION ALL SELECT '5a31a351-d4b8-538f-aaf5-f6b1591d15fe'::uuid, "id", 'ru', 'Мука, солод и крахмал' FROM "Category" WHERE "slug" = 'hs-11'
UNION ALL SELECT '4054ae25-ed02-5c3f-9b37-3feb786d4c83'::uuid, "id", 'kk', 'Ұн, уыт және крахмал' FROM "Category" WHERE "slug" = 'hs-11'
UNION ALL SELECT '05885511-24e8-55c0-9e04-e4a870e1aca2'::uuid, "id", 'ru', 'Масличные семена и корма' FROM "Category" WHERE "slug" = 'hs-12'
UNION ALL SELECT 'd09530e8-f2b4-5795-b95a-26f523e47901'::uuid, "id", 'kk', 'Майлы тұқымдар және жем-шөп' FROM "Category" WHERE "slug" = 'hs-12'
UNION ALL SELECT 'd97f16c5-914d-50d6-bb62-f4af88f2e1ac'::uuid, "id", 'ru', 'Камеди, смолы и растительные экстракты' FROM "Category" WHERE "slug" = 'hs-13'
UNION ALL SELECT '50b42853-7b24-5afb-b34f-d8fc62a3f08c'::uuid, "id", 'kk', 'Шайырлар және өсімдік сығындылары' FROM "Category" WHERE "slug" = 'hs-13'
UNION ALL SELECT '1a00ff2b-31f0-566e-ac2d-846aff648a8a'::uuid, "id", 'ru', 'Растительные материалы для плетения' FROM "Category" WHERE "slug" = 'hs-14'
UNION ALL SELECT '504f7c0a-a665-5657-b503-2a0d22160977'::uuid, "id", 'kk', 'Өруге арналған өсімдік материалдары' FROM "Category" WHERE "slug" = 'hs-14'
UNION ALL SELECT '14c63f94-8406-5ef4-9c23-6be8b2b80cbf'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-02'
UNION ALL SELECT 'cfc1206e-247e-5864-bcea-b9b7a5c7b515'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-02'
UNION ALL SELECT '8f35f405-a32f-5580-9466-ea4eb124729e'::uuid, "id", 'ru', 'Жиры и масла' FROM "Category" WHERE "slug" = 'hs-section-03'
UNION ALL SELECT '54dc8e9b-9606-58d8-b43c-915cdfc2cad8'::uuid, "id", 'kk', 'Майлар' FROM "Category" WHERE "slug" = 'hs-section-03'
UNION ALL SELECT 'e758efa1-6f72-55fe-9766-0cea3445efcc'::uuid, "id", 'ru', 'Животные и растительные жиры и масла' FROM "Category" WHERE "slug" = 'hs-15'
UNION ALL SELECT 'f735eb3e-1ef2-5b37-8553-862135bf4b6e'::uuid, "id", 'kk', 'Жануар және өсімдік майлары' FROM "Category" WHERE "slug" = 'hs-15'
UNION ALL SELECT 'd6e777de-308a-58d0-a4ea-890425d837b0'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-03'
UNION ALL SELECT '1da3bfd6-26b2-5d3a-87dc-d180f84c7035'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-03'
UNION ALL SELECT 'fefe1060-c3b6-5db7-9221-e2978c3a1f5b'::uuid, "id", 'ru', 'Готовые продукты, напитки и табак' FROM "Category" WHERE "slug" = 'hs-section-04'
UNION ALL SELECT '9f6a51d7-881e-58e2-9b43-76bf5337c430'::uuid, "id", 'kk', 'Дайын азық-түлік, сусындар және темекі' FROM "Category" WHERE "slug" = 'hs-section-04'
UNION ALL SELECT '79e30cd4-3d93-5f33-ae7d-4922f4d62e23'::uuid, "id", 'ru', 'Изделия из мяса и рыбы' FROM "Category" WHERE "slug" = 'hs-16'
UNION ALL SELECT 'fa476670-6f93-598f-a5cf-3394140b5761'::uuid, "id", 'kk', 'Ет және балық өнімдері' FROM "Category" WHERE "slug" = 'hs-16'
UNION ALL SELECT '5831d8b5-86b6-5eb4-8f85-e0f600d62aa1'::uuid, "id", 'ru', 'Сахар и кондитерские изделия из сахара' FROM "Category" WHERE "slug" = 'hs-17'
UNION ALL SELECT '319b8c3e-bf07-565a-85a3-350d2540703f'::uuid, "id", 'kk', 'Қант және қант кондитерлік өнімдері' FROM "Category" WHERE "slug" = 'hs-17'
UNION ALL SELECT 'd447b300-1de6-545a-8f0c-69deeda8aac5'::uuid, "id", 'ru', 'Какао и шоколад' FROM "Category" WHERE "slug" = 'hs-18'
UNION ALL SELECT '62477354-55e5-5778-a1ee-209fb695a320'::uuid, "id", 'kk', 'Какао және шоколад' FROM "Category" WHERE "slug" = 'hs-18'
UNION ALL SELECT 'e999c49e-e5a5-5d17-9383-47def753fef3'::uuid, "id", 'ru', 'Выпечка, макароны и изделия из зерна' FROM "Category" WHERE "slug" = 'hs-19'
UNION ALL SELECT '970da6c9-f063-5c75-ae1e-966048e256f3'::uuid, "id", 'kk', 'Нан-тоқаш, макарон және дән өнімдері' FROM "Category" WHERE "slug" = 'hs-19'
UNION ALL SELECT 'c5ec0b87-a9d5-5b1a-a63b-282feb47b87e'::uuid, "id", 'ru', 'Консервированные овощи и фрукты' FROM "Category" WHERE "slug" = 'hs-20'
UNION ALL SELECT 'c08b570e-42e1-5996-b779-f828b8933807'::uuid, "id", 'kk', 'Консервіленген көкөністер мен жемістер' FROM "Category" WHERE "slug" = 'hs-20'
UNION ALL SELECT 'a4d8fad9-0753-5e43-b919-6d392128e903'::uuid, "id", 'ru', 'Прочие пищевые продукты' FROM "Category" WHERE "slug" = 'hs-21'
UNION ALL SELECT 'a0933bc5-6cd9-5dc0-b807-72c04b11aaac'::uuid, "id", 'kk', 'Басқа азық-түлік өнімдері' FROM "Category" WHERE "slug" = 'hs-21'
UNION ALL SELECT '96ce994c-c8d9-584f-bc0f-6a1f9c15b983'::uuid, "id", 'ru', 'Напитки и уксус' FROM "Category" WHERE "slug" = 'hs-22'
UNION ALL SELECT 'cf866122-b1f5-5b75-918d-48530b244766'::uuid, "id", 'kk', 'Сусындар және сірке суы' FROM "Category" WHERE "slug" = 'hs-22'
UNION ALL SELECT 'ef62824f-59f2-57e7-b0ca-15ed4444f8d1'::uuid, "id", 'ru', 'Отходы пищевой промышленности и корма' FROM "Category" WHERE "slug" = 'hs-23'
UNION ALL SELECT '50f59125-4277-5a19-a81a-53ca7511a138'::uuid, "id", 'kk', 'Тамақ өнеркәсібінің қалдықтары және мал азығы' FROM "Category" WHERE "slug" = 'hs-23'
UNION ALL SELECT '3d47df7b-c7d6-53ff-8f58-3aede279a921'::uuid, "id", 'ru', 'Табак' FROM "Category" WHERE "slug" = 'hs-24'
UNION ALL SELECT '5f85c09a-a364-5d34-9b37-67c61b8d2c49'::uuid, "id", 'kk', 'Темекі' FROM "Category" WHERE "slug" = 'hs-24'
UNION ALL SELECT '12d4fdcf-c2c6-56cc-b5c1-5f7d40b067a9'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-04'
UNION ALL SELECT 'bbcc2da3-b188-525a-bfb7-0ba6201a0cbb'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-04'
UNION ALL SELECT 'ed68732b-6723-544c-b379-f140fe35ca6b'::uuid, "id", 'ru', 'Минеральные продукты и топливо' FROM "Category" WHERE "slug" = 'hs-section-05'
UNION ALL SELECT '80b62755-e20e-5690-bf69-914372f027a3'::uuid, "id", 'kk', 'Минералдық өнімдер және отын' FROM "Category" WHERE "slug" = 'hs-section-05'
UNION ALL SELECT '041dd203-cdde-5670-887d-627e6b2acc7a'::uuid, "id", 'ru', 'Соль, сера, камень и цемент' FROM "Category" WHERE "slug" = 'hs-25'
UNION ALL SELECT '98527bce-ec13-5441-83b9-94f3224e7e00'::uuid, "id", 'kk', 'Тұз, күкірт, тас және цемент' FROM "Category" WHERE "slug" = 'hs-25'
UNION ALL SELECT '58b7be51-329c-5960-a8de-07ce38d28297'::uuid, "id", 'ru', 'Руды, шлак и зола' FROM "Category" WHERE "slug" = 'hs-26'
UNION ALL SELECT '5d5f14f8-5533-55db-ba9b-0c2e1bde4588'::uuid, "id", 'kk', 'Кендер, қож және күл' FROM "Category" WHERE "slug" = 'hs-26'
UNION ALL SELECT '5ac27d48-a32f-5b2f-8582-54c41d0974dc'::uuid, "id", 'ru', 'Минеральное топливо и нефтепродукты' FROM "Category" WHERE "slug" = 'hs-27'
UNION ALL SELECT '75341af3-d452-517e-9026-13db3b9718f2'::uuid, "id", 'kk', 'Минералдық отын және мұнай өнімдері' FROM "Category" WHERE "slug" = 'hs-27'
UNION ALL SELECT 'd8746750-75ab-5136-b492-1e1ec26495d7'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-05'
UNION ALL SELECT '00ce264f-c6ec-5b81-ac8e-6b44cea0d55d'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-05'
UNION ALL SELECT '4864aad5-a870-570d-8ee9-c3046d6b2ea5'::uuid, "id", 'ru', 'Химическая продукция' FROM "Category" WHERE "slug" = 'hs-section-06'
UNION ALL SELECT '03ee97e4-3fde-5563-aaec-b5fa9f4b0771'::uuid, "id", 'kk', 'Химия өнімдері' FROM "Category" WHERE "slug" = 'hs-section-06'
UNION ALL SELECT '8256da78-c015-5262-a9c5-7a236dc56fa8'::uuid, "id", 'ru', 'Неорганические химические вещества' FROM "Category" WHERE "slug" = 'hs-28'
UNION ALL SELECT '5e9d304d-20ca-516a-b690-1a6e914788c1'::uuid, "id", 'kk', 'Бейорганикалық химиялық заттар' FROM "Category" WHERE "slug" = 'hs-28'
UNION ALL SELECT 'b2d999d8-4052-5f4b-9901-b188be2b47a6'::uuid, "id", 'ru', 'Органические химические вещества' FROM "Category" WHERE "slug" = 'hs-29'
UNION ALL SELECT '105a4836-a13c-5862-9aba-1a93dc9e5104'::uuid, "id", 'kk', 'Органикалық химиялық заттар' FROM "Category" WHERE "slug" = 'hs-29'
UNION ALL SELECT '932052cd-e834-5f35-a962-43cff5f7f131'::uuid, "id", 'ru', 'Фармацевтическая продукция' FROM "Category" WHERE "slug" = 'hs-30'
UNION ALL SELECT 'b53ec7c8-3023-5737-a2c6-798f7d88fdc5'::uuid, "id", 'kk', 'Фармацевтикалық өнімдер' FROM "Category" WHERE "slug" = 'hs-30'
UNION ALL SELECT 'e3fa7349-b6d2-52fd-b16a-f207109d48e3'::uuid, "id", 'ru', 'Удобрения' FROM "Category" WHERE "slug" = 'hs-31'
UNION ALL SELECT 'd841a89e-e547-56c8-acfd-c447ba8880f7'::uuid, "id", 'kk', 'Тыңайтқыштар' FROM "Category" WHERE "slug" = 'hs-31'
UNION ALL SELECT '6b98725c-cf0d-5887-9dce-fa0e44cf61fb'::uuid, "id", 'ru', 'Краски, красители и чернила' FROM "Category" WHERE "slug" = 'hs-32'
UNION ALL SELECT 'fd1edee4-48e8-541a-bd8b-f9de7c37f4ba'::uuid, "id", 'kk', 'Бояулар, бояғыштар және сия' FROM "Category" WHERE "slug" = 'hs-32'
UNION ALL SELECT 'a53d3a22-cc07-5a52-9eca-6bf7b53e6beb'::uuid, "id", 'ru', 'Эфирные масла и косметика' FROM "Category" WHERE "slug" = 'hs-33'
UNION ALL SELECT '699130fc-271a-5db0-99d3-57d55982f245'::uuid, "id", 'kk', 'Эфир майлары және косметика' FROM "Category" WHERE "slug" = 'hs-33'
UNION ALL SELECT '01349b8e-c392-5a04-afaf-d575ff1909ce'::uuid, "id", 'ru', 'Мыло, моющие средства и воски' FROM "Category" WHERE "slug" = 'hs-34'
UNION ALL SELECT '4f561531-51b1-5705-875c-1767fed1e665'::uuid, "id", 'kk', 'Сабын, жуғыш заттар және балауыз' FROM "Category" WHERE "slug" = 'hs-34'
UNION ALL SELECT '43456901-6ecf-56e8-8af8-45430a27efd7'::uuid, "id", 'ru', 'Белки, клеи и ферменты' FROM "Category" WHERE "slug" = 'hs-35'
UNION ALL SELECT '840f37d4-9ade-52eb-b1f7-c247a20dea65'::uuid, "id", 'kk', 'Ақуыздар, желімдер және ферменттер' FROM "Category" WHERE "slug" = 'hs-35'
UNION ALL SELECT '091da16f-814c-5a63-adf7-73dfe81e7ba0'::uuid, "id", 'ru', 'Фото- и кинотовары' FROM "Category" WHERE "slug" = 'hs-37'
UNION ALL SELECT 'e296a040-8eac-56dc-8e54-315a18eab4df'::uuid, "id", 'kk', 'Фото- және кино тауарлары' FROM "Category" WHERE "slug" = 'hs-37'
UNION ALL SELECT 'd47ea5e8-8d2a-5a7d-bf62-9602b9ef23bd'::uuid, "id", 'ru', 'Прочие химические продукты' FROM "Category" WHERE "slug" = 'hs-38'
UNION ALL SELECT '1aebdc7e-d5ac-508b-af66-1f0c20d82217'::uuid, "id", 'kk', 'Басқа химиялық өнімдер' FROM "Category" WHERE "slug" = 'hs-38'
UNION ALL SELECT '1bb1bf2b-de52-5714-9b8f-360afa12e282'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-06'
UNION ALL SELECT '6bc2141f-993a-5abd-9d5d-ef13bd51d7e3'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-06'
UNION ALL SELECT 'eb0f830a-cf76-58ba-ba3d-88246ab3d11b'::uuid, "id", 'ru', 'Пластмассы и резина' FROM "Category" WHERE "slug" = 'hs-section-07'
UNION ALL SELECT '195299f7-a238-577e-b00a-e526522e6d42'::uuid, "id", 'kk', 'Пластмассалар және резеңке' FROM "Category" WHERE "slug" = 'hs-section-07'
UNION ALL SELECT 'c67d5e4e-35b6-5f43-aa89-25ae8bd13142'::uuid, "id", 'ru', 'Пластмассы и изделия из них' FROM "Category" WHERE "slug" = 'hs-39'
UNION ALL SELECT 'f8b71180-93ed-5082-ab0b-74e84bd3342a'::uuid, "id", 'kk', 'Пластмассалар және пластмасса бұйымдары' FROM "Category" WHERE "slug" = 'hs-39'
UNION ALL SELECT 'b7444c87-69b4-5a05-8bd8-890302e8a2b7'::uuid, "id", 'ru', 'Каучук, резина и изделия из них' FROM "Category" WHERE "slug" = 'hs-40'
UNION ALL SELECT '61d27cd9-a544-5bea-aa3f-5ff70275f2d6'::uuid, "id", 'kk', 'Каучук, резеңке және резеңке бұйымдары' FROM "Category" WHERE "slug" = 'hs-40'
UNION ALL SELECT 'f479c89c-acdf-5c67-9904-8e3969d49ebd'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-07'
UNION ALL SELECT '52e94414-050e-57f7-85a9-2657ffff4cc9'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-07'
UNION ALL SELECT '914eaa3a-3ecd-5313-8ef8-e39e96e897f9'::uuid, "id", 'ru', 'Кожа и мех' FROM "Category" WHERE "slug" = 'hs-section-08'
UNION ALL SELECT '309d855e-16bc-5b35-ab4e-4349dcd2b996'::uuid, "id", 'kk', 'Былғары және үлбір' FROM "Category" WHERE "slug" = 'hs-section-08'
UNION ALL SELECT '2cf84662-8fe9-5f2d-865c-cef2677619dc'::uuid, "id", 'ru', 'Необработанные шкуры и кожа' FROM "Category" WHERE "slug" = 'hs-41'
UNION ALL SELECT '1b01334c-37f8-53ea-968e-3cdbca0f7f40'::uuid, "id", 'kk', 'Өңделмеген терілер және былғары' FROM "Category" WHERE "slug" = 'hs-41'
UNION ALL SELECT '214c1d1a-f07e-55e6-bc8c-fbba89bff9ad'::uuid, "id", 'ru', 'Изделия из кожи и сумки' FROM "Category" WHERE "slug" = 'hs-42'
UNION ALL SELECT '955b0295-07d4-53bd-8da7-f43f8811b119'::uuid, "id", 'kk', 'Былғары бұйымдары және сөмкелер' FROM "Category" WHERE "slug" = 'hs-42'
UNION ALL SELECT 'c61a71be-6f44-5793-a309-4ea913012710'::uuid, "id", 'ru', 'Натуральный и искусственный мех' FROM "Category" WHERE "slug" = 'hs-43'
UNION ALL SELECT '4a35e83d-00ca-5277-92a0-15dffef90631'::uuid, "id", 'kk', 'Табиғи және жасанды үлбір' FROM "Category" WHERE "slug" = 'hs-43'
UNION ALL SELECT '98007597-4ffb-5365-bb09-39c3ce3878f7'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-08'
UNION ALL SELECT '3e7286ab-3cce-5cac-a48e-37f6c4c630db'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-08'
UNION ALL SELECT '7460b135-21ef-50be-8bdd-62869c55f5db'::uuid, "id", 'ru', 'Древесина, пробка и плетёные изделия' FROM "Category" WHERE "slug" = 'hs-section-09'
UNION ALL SELECT '8ba99079-3f4e-5446-b07a-3b99e323271e'::uuid, "id", 'kk', 'Ағаш, тығын және өрме бұйымдар' FROM "Category" WHERE "slug" = 'hs-section-09'
UNION ALL SELECT '9baf71b1-4c05-56ce-a9e0-9ed0e55b2b2b'::uuid, "id", 'ru', 'Древесина и изделия из неё' FROM "Category" WHERE "slug" = 'hs-44'
UNION ALL SELECT '82f92f0b-7bfe-5753-97c6-7485bd45d5f9'::uuid, "id", 'kk', 'Ағаш және ағаш бұйымдары' FROM "Category" WHERE "slug" = 'hs-44'
UNION ALL SELECT 'd51add2a-295c-5757-8ede-e837340a5e1b'::uuid, "id", 'ru', 'Пробка' FROM "Category" WHERE "slug" = 'hs-45'
UNION ALL SELECT 'eb2f40fe-8c06-5155-945d-effbe16365d8'::uuid, "id", 'kk', 'Тығын' FROM "Category" WHERE "slug" = 'hs-45'
UNION ALL SELECT '258797ce-98ca-57bf-8c3d-6e07ca0eef62'::uuid, "id", 'ru', 'Плетёные изделия' FROM "Category" WHERE "slug" = 'hs-46'
UNION ALL SELECT 'f6e8613f-22e2-50ec-92e9-552bb3383529'::uuid, "id", 'kk', 'Өрме бұйымдар' FROM "Category" WHERE "slug" = 'hs-46'
UNION ALL SELECT '74cb663b-ce04-5e7d-adef-2ce0ce673416'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-09'
UNION ALL SELECT '566b6fc0-4d6e-5f9f-8873-07eea2c22b95'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-09'
UNION ALL SELECT '2855dd97-7b40-574e-b100-decea1b9c14d'::uuid, "id", 'ru', 'Бумага, упаковка и печатная продукция' FROM "Category" WHERE "slug" = 'hs-section-10'
UNION ALL SELECT '55994bb2-1d33-5dc9-8d53-98c9dda4b637'::uuid, "id", 'kk', 'Қағаз, орама және баспа өнімдері' FROM "Category" WHERE "slug" = 'hs-section-10'
UNION ALL SELECT 'fdff67fd-35af-5378-bcfb-c148a5a0cae4'::uuid, "id", 'ru', 'Целлюлоза и макулатура' FROM "Category" WHERE "slug" = 'hs-47'
UNION ALL SELECT '4d11bdcf-a0cc-504c-82e9-75c3a899784d'::uuid, "id", 'kk', 'Целлюлоза және қағаз қалдықтары' FROM "Category" WHERE "slug" = 'hs-47'
UNION ALL SELECT '13b316b4-3a90-5467-8f80-a2cf3b8da151'::uuid, "id", 'ru', 'Бумага и картон' FROM "Category" WHERE "slug" = 'hs-48'
UNION ALL SELECT 'c0418db4-64e0-5b35-a7c1-27f7b1c54a44'::uuid, "id", 'kk', 'Қағаз және картон' FROM "Category" WHERE "slug" = 'hs-48'
UNION ALL SELECT 'f90a46de-3183-55de-abf5-ed555443f259'::uuid, "id", 'ru', 'Печатная продукция' FROM "Category" WHERE "slug" = 'hs-49'
UNION ALL SELECT '1fff8cb9-bb41-524d-92f2-41e131e5e74b'::uuid, "id", 'kk', 'Баспа өнімдері' FROM "Category" WHERE "slug" = 'hs-49'
UNION ALL SELECT '8fa32d11-a0b1-59cc-ab2d-19345e1fd011'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-10'
UNION ALL SELECT '7e79df63-ef7d-580d-9ad5-e64df5688856'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-10'
UNION ALL SELECT '13b3a167-dcf6-5b3a-add2-021ffefb1223'::uuid, "id", 'ru', 'Текстиль и одежда' FROM "Category" WHERE "slug" = 'hs-section-11'
UNION ALL SELECT '0c327c3c-dac5-539b-83ea-2a70c64c6ddd'::uuid, "id", 'kk', 'Тоқыма және киім' FROM "Category" WHERE "slug" = 'hs-section-11'
UNION ALL SELECT '113e6aa2-45c2-55fb-9af0-6d4dbe745b31'::uuid, "id", 'ru', 'Шёлк' FROM "Category" WHERE "slug" = 'hs-50'
UNION ALL SELECT 'cd2058e7-f0e7-5236-a37e-a1cdfe591bc9'::uuid, "id", 'kk', 'Жібек' FROM "Category" WHERE "slug" = 'hs-50'
UNION ALL SELECT '8ffdc032-4343-5603-a6b9-cb9951dcbc0e'::uuid, "id", 'ru', 'Шерсть и волос животных' FROM "Category" WHERE "slug" = 'hs-51'
UNION ALL SELECT 'f1183292-4e14-50fc-88f5-dcdb070190b6'::uuid, "id", 'kk', 'Жүн және жануар қылы' FROM "Category" WHERE "slug" = 'hs-51'
UNION ALL SELECT '77752d8f-12c0-5ecf-970a-82c54e5764a2'::uuid, "id", 'ru', 'Хлопок' FROM "Category" WHERE "slug" = 'hs-52'
UNION ALL SELECT 'ba856cf0-8a1f-59b6-9c2b-8920bec55ea9'::uuid, "id", 'kk', 'Мақта' FROM "Category" WHERE "slug" = 'hs-52'
UNION ALL SELECT 'f5fe0954-0ad9-5b97-b510-084d58483275'::uuid, "id", 'ru', 'Прочие растительные волокна' FROM "Category" WHERE "slug" = 'hs-53'
UNION ALL SELECT '6597e0e4-1f39-5ab6-a154-92d9f0ae13ea'::uuid, "id", 'kk', 'Басқа өсімдік талшықтары' FROM "Category" WHERE "slug" = 'hs-53'
UNION ALL SELECT '69673c89-594e-5721-a76a-30f28f6ac672'::uuid, "id", 'ru', 'Химические нити' FROM "Category" WHERE "slug" = 'hs-54'
UNION ALL SELECT 'b3a88dd2-2289-540d-86cb-1e7c351d6f31'::uuid, "id", 'kk', 'Химиялық жіптер' FROM "Category" WHERE "slug" = 'hs-54'
UNION ALL SELECT '905aaf2e-b568-50f9-8688-9e476cd0689a'::uuid, "id", 'ru', 'Химические волокна' FROM "Category" WHERE "slug" = 'hs-55'
UNION ALL SELECT '121ac84c-76e1-501f-877e-e959eb33907b'::uuid, "id", 'kk', 'Химиялық талшықтар' FROM "Category" WHERE "slug" = 'hs-55'
UNION ALL SELECT 'acf8c43f-ac09-59b8-9615-775564653385'::uuid, "id", 'ru', 'Вата, войлок, нетканые материалы и канаты' FROM "Category" WHERE "slug" = 'hs-56'
UNION ALL SELECT '41c1b10b-bcdd-56eb-a963-19511ac5d5fa'::uuid, "id", 'kk', 'Мамық, киіз, тоқылмаған материалдар және арқандар' FROM "Category" WHERE "slug" = 'hs-56'
UNION ALL SELECT 'c0c6fc92-0fd8-502a-ae06-d410cb04dcf9'::uuid, "id", 'ru', 'Ковры и напольные покрытия' FROM "Category" WHERE "slug" = 'hs-57'
UNION ALL SELECT '30670753-e569-51aa-825e-5f254fe66a45'::uuid, "id", 'kk', 'Кілемдер және еден жабындары' FROM "Category" WHERE "slug" = 'hs-57'
UNION ALL SELECT 'bd051cc5-6172-50db-958b-5a020eb56c35'::uuid, "id", 'ru', 'Специальные ткани и кружево' FROM "Category" WHERE "slug" = 'hs-58'
UNION ALL SELECT '02a5abc6-ba75-53ab-93ae-9190f25d8e25'::uuid, "id", 'kk', 'Арнайы маталар және шілтер' FROM "Category" WHERE "slug" = 'hs-58'
UNION ALL SELECT '02e58822-0487-5ab6-81b9-dd567d45374c'::uuid, "id", 'ru', 'Пропитанные и технические ткани' FROM "Category" WHERE "slug" = 'hs-59'
UNION ALL SELECT '1cce747d-0c63-589b-ba51-de295e297b5b'::uuid, "id", 'kk', 'Сіңдірілген және техникалық маталар' FROM "Category" WHERE "slug" = 'hs-59'
UNION ALL SELECT 'a26cfaa1-bd19-5a01-ab6b-e9de85cfb186'::uuid, "id", 'ru', 'Трикотажные полотна' FROM "Category" WHERE "slug" = 'hs-60'
UNION ALL SELECT '1dae0d55-e7eb-574c-8af1-189a6bc22072'::uuid, "id", 'kk', 'Трикотаж маталар' FROM "Category" WHERE "slug" = 'hs-60'
UNION ALL SELECT '28af6930-c47f-5a1b-9626-06afc0f84398'::uuid, "id", 'ru', 'Трикотажная одежда' FROM "Category" WHERE "slug" = 'hs-61'
UNION ALL SELECT 'b0f2641e-fcc5-5687-9e8b-c4f454522645'::uuid, "id", 'kk', 'Трикотаж киім' FROM "Category" WHERE "slug" = 'hs-61'
UNION ALL SELECT 'f0ebea8e-cc61-5dcf-bb3b-c28014ac4c71'::uuid, "id", 'ru', 'Одежда из тканей' FROM "Category" WHERE "slug" = 'hs-62'
UNION ALL SELECT 'fa692b8a-fae0-50ae-b114-7bfa41aa7e27'::uuid, "id", 'kk', 'Матадан тігілген киім' FROM "Category" WHERE "slug" = 'hs-62'
UNION ALL SELECT 'b14f6028-03bd-5455-a9b3-a24b32001953'::uuid, "id", 'ru', 'Домашний текстиль и одежда, бывшая в употреблении' FROM "Category" WHERE "slug" = 'hs-63'
UNION ALL SELECT '06eafbec-505f-557a-af98-36d5244bbfc4'::uuid, "id", 'kk', 'Үй тоқымасы және пайдаланылған киім' FROM "Category" WHERE "slug" = 'hs-63'
UNION ALL SELECT '0a6b4fd8-d0a4-5700-b650-7f45e8e55933'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-11'
UNION ALL SELECT 'c9e3546a-a4e5-5645-9cf3-d4b8e460ac8b'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-11'
UNION ALL SELECT 'e0111f29-63fd-5cd9-9064-6b76ffea9da5'::uuid, "id", 'ru', 'Обувь, головные уборы и зонты' FROM "Category" WHERE "slug" = 'hs-section-12'
UNION ALL SELECT '8cd89741-62aa-5c6d-8c93-240578b4d79a'::uuid, "id", 'kk', 'Аяқ киім, бас киім және қолшатырлар' FROM "Category" WHERE "slug" = 'hs-section-12'
UNION ALL SELECT '74af0f2c-fdac-5234-902a-7e8624e36881'::uuid, "id", 'ru', 'Обувь' FROM "Category" WHERE "slug" = 'hs-64'
UNION ALL SELECT '73602af4-404e-531a-9f05-74a782b7f9ac'::uuid, "id", 'kk', 'Аяқ киім' FROM "Category" WHERE "slug" = 'hs-64'
UNION ALL SELECT 'ba26d310-51d7-5b06-b26d-402e17886ae5'::uuid, "id", 'ru', 'Головные уборы' FROM "Category" WHERE "slug" = 'hs-65'
UNION ALL SELECT 'e86dc5fc-ef11-5ddb-976b-cba6abdad5d0'::uuid, "id", 'kk', 'Бас киімдер' FROM "Category" WHERE "slug" = 'hs-65'
UNION ALL SELECT '68142fed-e878-5f1c-b71a-f8f7d282d369'::uuid, "id", 'ru', 'Зонты и трости' FROM "Category" WHERE "slug" = 'hs-66'
UNION ALL SELECT '4630326f-1362-51f6-9f43-e01e121e2e31'::uuid, "id", 'kk', 'Қолшатырлар және таяқтар' FROM "Category" WHERE "slug" = 'hs-66'
UNION ALL SELECT '4ca6dade-89f2-5a81-ab7b-2d28632a8e9a'::uuid, "id", 'ru', 'Перья и искусственные цветы' FROM "Category" WHERE "slug" = 'hs-67'
UNION ALL SELECT '51909f88-4213-5cb8-85df-08d444df680c'::uuid, "id", 'kk', 'Қауырсындар және жасанды гүлдер' FROM "Category" WHERE "slug" = 'hs-67'
UNION ALL SELECT '0253b44a-7b85-5d37-9a9c-4a3c5cdb0dba'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-12'
UNION ALL SELECT '248ccb7f-44e3-5c0e-8c21-5bd1c649b6f0'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-12'
UNION ALL SELECT 'd059eeea-522d-526f-a9d1-4ecb451b8c1e'::uuid, "id", 'ru', 'Камень, керамика и стекло' FROM "Category" WHERE "slug" = 'hs-section-13'
UNION ALL SELECT '22427829-a4c2-5ce8-935b-7013d9265de9'::uuid, "id", 'kk', 'Тас, керамика және шыны' FROM "Category" WHERE "slug" = 'hs-section-13'
UNION ALL SELECT 'af4beaa3-7291-5a84-bf75-a01f8e077695'::uuid, "id", 'ru', 'Изделия из камня, гипса и цемента' FROM "Category" WHERE "slug" = 'hs-68'
UNION ALL SELECT '4856cb18-0fe7-5d93-bbe0-3c1cfc168e46'::uuid, "id", 'kk', 'Тас, гипс және цемент бұйымдары' FROM "Category" WHERE "slug" = 'hs-68'
UNION ALL SELECT '789711cf-2c68-5839-b8c7-8321ef96e415'::uuid, "id", 'ru', 'Керамические изделия' FROM "Category" WHERE "slug" = 'hs-69'
UNION ALL SELECT '961b1530-24a4-59b2-ab21-3ec9ab3e6cc4'::uuid, "id", 'kk', 'Керамикалық бұйымдар' FROM "Category" WHERE "slug" = 'hs-69'
UNION ALL SELECT '22bd5f8d-07cb-5e06-8c12-956223fa1e5e'::uuid, "id", 'ru', 'Стекло и изделия из стекла' FROM "Category" WHERE "slug" = 'hs-70'
UNION ALL SELECT '48f61506-5f12-5028-b650-e84a625a1b6a'::uuid, "id", 'kk', 'Шыны және шыны бұйымдары' FROM "Category" WHERE "slug" = 'hs-70'
UNION ALL SELECT '1ebbcaec-de7a-5123-a1ac-110388736410'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-13'
UNION ALL SELECT '0274e7a2-aa27-5655-8a56-35d710eef03d'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-13'
UNION ALL SELECT '3d61c1c4-dd4a-5e32-8de7-0ad7dedea0e4'::uuid, "id", 'ru', 'Драгоценные металлы и ювелирные изделия' FROM "Category" WHERE "slug" = 'hs-section-14'
UNION ALL SELECT '2918cc02-5b98-5c30-8ca8-ca547cfe8649'::uuid, "id", 'kk', 'Асыл металдар және зергерлік бұйымдар' FROM "Category" WHERE "slug" = 'hs-section-14'
UNION ALL SELECT '7333c04d-6dd0-5f48-83ef-bf8aa2b1ac58'::uuid, "id", 'ru', 'Драгоценные металлы, камни и ювелирные изделия' FROM "Category" WHERE "slug" = 'hs-71'
UNION ALL SELECT '65516534-de19-55cf-81dc-8289f1ac14e1'::uuid, "id", 'kk', 'Асыл металдар, асыл тастар және зергерлік бұйымдар' FROM "Category" WHERE "slug" = 'hs-71'
UNION ALL SELECT 'a6df461d-cc5b-5202-8f22-ce7b9638b984'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-14'
UNION ALL SELECT '20956833-7574-5c97-af72-cab59c6b28b8'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-14'
UNION ALL SELECT '87b7975b-3dbe-52cd-a02f-1e78dc6bafef'::uuid, "id", 'ru', 'Недрагоценные металлы и изделия из них' FROM "Category" WHERE "slug" = 'hs-section-15'
UNION ALL SELECT 'ed5a475b-99dd-5511-bb59-54d61b559911'::uuid, "id", 'kk', 'Негізгі металдар және металл бұйымдары' FROM "Category" WHERE "slug" = 'hs-section-15'
UNION ALL SELECT 'bd0511fa-e476-5d85-8d5c-f9cca47b9483'::uuid, "id", 'ru', 'Чёрные металлы' FROM "Category" WHERE "slug" = 'hs-72'
UNION ALL SELECT 'd4430ea7-f7ab-5700-9c28-acbd150fbc94'::uuid, "id", 'kk', 'Шойын және болат' FROM "Category" WHERE "slug" = 'hs-72'
UNION ALL SELECT 'd0669be4-e364-5958-a8fb-7a2048d406b1'::uuid, "id", 'ru', 'Изделия из чёрных металлов' FROM "Category" WHERE "slug" = 'hs-73'
UNION ALL SELECT '494cd50d-f7aa-565c-b071-99bba61ef64d'::uuid, "id", 'kk', 'Шойын мен болат бұйымдары' FROM "Category" WHERE "slug" = 'hs-73'
UNION ALL SELECT 'd40e1868-2fb7-5dd6-8b4a-5eb4741182e8'::uuid, "id", 'ru', 'Медь и изделия из неё' FROM "Category" WHERE "slug" = 'hs-74'
UNION ALL SELECT 'fb0c7c4c-6576-5638-8a19-d6a973be196f'::uuid, "id", 'kk', 'Мыс және мыс бұйымдары' FROM "Category" WHERE "slug" = 'hs-74'
UNION ALL SELECT '311baf37-94f5-5bdd-b683-a9180ee88b7b'::uuid, "id", 'ru', 'Никель и изделия из него' FROM "Category" WHERE "slug" = 'hs-75'
UNION ALL SELECT 'bc95cb6f-aeab-5655-9e63-11a688b423d5'::uuid, "id", 'kk', 'Никель және никель бұйымдары' FROM "Category" WHERE "slug" = 'hs-75'
UNION ALL SELECT '0953fe3e-cf5c-53fc-8f9d-49fcd404c989'::uuid, "id", 'ru', 'Алюминий и изделия из него' FROM "Category" WHERE "slug" = 'hs-76'
UNION ALL SELECT '7ecd8c8b-06f4-5d1e-bd09-60dc5bb31eac'::uuid, "id", 'kk', 'Алюминий және алюминий бұйымдары' FROM "Category" WHERE "slug" = 'hs-76'
UNION ALL SELECT '531046cd-3f32-505e-b7be-b5a25b555f67'::uuid, "id", 'ru', 'Свинец и изделия из него' FROM "Category" WHERE "slug" = 'hs-78'
UNION ALL SELECT 'b0e07e56-56e5-5c21-aff0-9f873022fb51'::uuid, "id", 'kk', 'Қорғасын және қорғасын бұйымдары' FROM "Category" WHERE "slug" = 'hs-78'
UNION ALL SELECT 'd79a8596-5beb-5f90-85e4-37c8710b2f7f'::uuid, "id", 'ru', 'Цинк и изделия из него' FROM "Category" WHERE "slug" = 'hs-79'
UNION ALL SELECT '4dab7a4d-107c-5af9-9f49-42a0593e06c6'::uuid, "id", 'kk', 'Мырыш және мырыш бұйымдары' FROM "Category" WHERE "slug" = 'hs-79'
UNION ALL SELECT '95c48e06-899f-5940-a841-b4a84e167115'::uuid, "id", 'ru', 'Олово и изделия из него' FROM "Category" WHERE "slug" = 'hs-80'
UNION ALL SELECT 'c519278c-11fb-54c1-a04d-79724e76d7b8'::uuid, "id", 'kk', 'Қалайы және қалайы бұйымдары' FROM "Category" WHERE "slug" = 'hs-80'
UNION ALL SELECT '330c86b0-2afa-5fd5-9f11-ec7120e7a44f'::uuid, "id", 'ru', 'Прочие недрагоценные металлы' FROM "Category" WHERE "slug" = 'hs-81'
UNION ALL SELECT 'f21199e6-b8e9-5cd4-82e2-fa6f08ea0523'::uuid, "id", 'kk', 'Басқа негізгі металдар' FROM "Category" WHERE "slug" = 'hs-81'
UNION ALL SELECT 'a74bd627-3b66-50d9-9a7b-cfe444baabdc'::uuid, "id", 'ru', 'Инструменты и столовые приборы' FROM "Category" WHERE "slug" = 'hs-82'
UNION ALL SELECT '43510109-9686-5db0-b197-d88788b2e7cb'::uuid, "id", 'kk', 'Құралдар және ас құралдары' FROM "Category" WHERE "slug" = 'hs-82'
UNION ALL SELECT 'da0d4e99-eb9d-5a32-9cc8-4fe801d3a013'::uuid, "id", 'ru', 'Прочие изделия из металла' FROM "Category" WHERE "slug" = 'hs-83'
UNION ALL SELECT '04ae74ef-f9fb-53e7-88d5-c53681d8bffd'::uuid, "id", 'kk', 'Басқа металл бұйымдары' FROM "Category" WHERE "slug" = 'hs-83'
UNION ALL SELECT '682acc01-57d6-58e0-9aaa-1faa9705f714'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-15'
UNION ALL SELECT '55d4dcbe-1ab6-55db-8487-0520e5ed0cf3'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-15'
UNION ALL SELECT 'b0f9879c-4660-5a07-9be1-477950bd3fc5'::uuid, "id", 'ru', 'Машины и электрооборудование' FROM "Category" WHERE "slug" = 'hs-section-16'
UNION ALL SELECT '90c10afc-ed21-5901-857a-785ff9f6b8c9'::uuid, "id", 'kk', 'Машиналар және электр жабдықтары' FROM "Category" WHERE "slug" = 'hs-section-16'
UNION ALL SELECT '82bb3806-d4a6-5895-a2a1-7aeee3d9e27a'::uuid, "id", 'ru', 'Машины и механическое оборудование' FROM "Category" WHERE "slug" = 'hs-84'
UNION ALL SELECT '65093125-9bd2-5faa-af80-39194d0d6053'::uuid, "id", 'kk', 'Машиналар және механикалық жабдықтар' FROM "Category" WHERE "slug" = 'hs-84'
UNION ALL SELECT '7e97dd67-aed6-5ec9-b9e4-6f757cc43c25'::uuid, "id", 'ru', 'Электрооборудование и электроника' FROM "Category" WHERE "slug" = 'hs-85'
UNION ALL SELECT '4f956bc3-1018-592e-9825-8937b35c5e66'::uuid, "id", 'kk', 'Электр жабдықтары және электроника' FROM "Category" WHERE "slug" = 'hs-85'
UNION ALL SELECT '51c94757-dbd1-5b7e-830f-86452b54ed29'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-16'
UNION ALL SELECT 'e8e4c480-cd1e-584b-ba90-247f7cc48b38'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-16'
UNION ALL SELECT '06008826-49fd-5f96-8080-2f59bbfa7a81'::uuid, "id", 'ru', 'Транспортные средства и оборудование' FROM "Category" WHERE "slug" = 'hs-section-17'
UNION ALL SELECT '7c98b778-f170-5e76-a697-0e27d0bc1c6c'::uuid, "id", 'kk', 'Көлік құралдары және жабдықтары' FROM "Category" WHERE "slug" = 'hs-section-17'
UNION ALL SELECT 'fbf6e9f8-2003-5ac8-bc03-eedc81ebf432'::uuid, "id", 'ru', 'Железнодорожный транспорт и оборудование' FROM "Category" WHERE "slug" = 'hs-86'
UNION ALL SELECT '927d6cbd-f806-56b8-927a-e782e069dfe3'::uuid, "id", 'kk', 'Темір жол көлігі және жабдықтары' FROM "Category" WHERE "slug" = 'hs-86'
UNION ALL SELECT '69443eea-6e28-5892-ad22-42d77d58e893'::uuid, "id", 'ru', 'Автомобили и запчасти' FROM "Category" WHERE "slug" = 'hs-87'
UNION ALL SELECT 'eeff171d-9ccb-5bd5-862a-59f226771816'::uuid, "id", 'kk', 'Автокөліктер және бөлшектер' FROM "Category" WHERE "slug" = 'hs-87'
UNION ALL SELECT '9474cdff-1550-539f-9128-28de8710ed85'::uuid, "id", 'ru', 'Летательные и космические аппараты' FROM "Category" WHERE "slug" = 'hs-88'
UNION ALL SELECT '6fc760e3-c49e-5444-976f-06a90c1aa5d0'::uuid, "id", 'kk', 'Ұшу және ғарыш аппараттары' FROM "Category" WHERE "slug" = 'hs-88'
UNION ALL SELECT '2a93ac6a-286f-5f9a-8143-f43c5a160a43'::uuid, "id", 'ru', 'Суда и лодки' FROM "Category" WHERE "slug" = 'hs-89'
UNION ALL SELECT '9af3ec37-1c33-5dba-97ac-395264d7eb5d'::uuid, "id", 'kk', 'Кемелер және қайықтар' FROM "Category" WHERE "slug" = 'hs-89'
UNION ALL SELECT '2d892fbc-748c-5956-804a-fb66269cd720'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-17'
UNION ALL SELECT 'e4ac46ca-a1d8-5898-b7f0-b1d618f629c2'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-17'
UNION ALL SELECT '45ee0eef-2e92-5a70-ae52-567608958a03'::uuid, "id", 'ru', 'Приборы, медицинское оборудование и часы' FROM "Category" WHERE "slug" = 'hs-section-18'
UNION ALL SELECT 'dcd8879a-a51e-5885-beef-f193c1a7488c'::uuid, "id", 'kk', 'Аспаптар, медициналық жабдықтар және сағаттар' FROM "Category" WHERE "slug" = 'hs-section-18'
UNION ALL SELECT 'b2fe4a58-af16-5629-a22d-ed9ce3bc0abc'::uuid, "id", 'ru', 'Оптические, измерительные и медицинские приборы' FROM "Category" WHERE "slug" = 'hs-90'
UNION ALL SELECT '1d10a95c-ba19-5092-bbcb-4a6d2b054b2a'::uuid, "id", 'kk', 'Оптикалық, өлшеу және медициналық аспаптар' FROM "Category" WHERE "slug" = 'hs-90'
UNION ALL SELECT '0b82edf9-80f5-530c-b021-330cf7691b0b'::uuid, "id", 'ru', 'Часы' FROM "Category" WHERE "slug" = 'hs-91'
UNION ALL SELECT 'e84f8e02-7969-5070-9a9a-578ee3ef2723'::uuid, "id", 'kk', 'Сағаттар' FROM "Category" WHERE "slug" = 'hs-91'
UNION ALL SELECT 'eb313ffc-0017-5b9d-86e2-de1c13f0e52a'::uuid, "id", 'ru', 'Музыкальные инструменты' FROM "Category" WHERE "slug" = 'hs-92'
UNION ALL SELECT '96d048e1-125c-5abe-85a8-6914affb6d15'::uuid, "id", 'kk', 'Музыкалық аспаптар' FROM "Category" WHERE "slug" = 'hs-92'
UNION ALL SELECT '4cf81764-7820-53f1-bbb8-633d25d27930'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-18'
UNION ALL SELECT '22b56d77-9df8-5a51-b564-54957d4c6b45'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-18'
UNION ALL SELECT '33e38c24-8386-5910-a93c-520d6a11481f'::uuid, "id", 'ru', 'Мебель, игрушки и прочие изделия' FROM "Category" WHERE "slug" = 'hs-section-20'
UNION ALL SELECT '0648434c-5615-529b-b578-7ee7539acead'::uuid, "id", 'kk', 'Жиһаз, ойыншықтар және басқа бұйымдар' FROM "Category" WHERE "slug" = 'hs-section-20'
UNION ALL SELECT '069abefe-26e7-5c3f-8b69-4d85441017e4'::uuid, "id", 'ru', 'Мебель, постельные принадлежности и светильники' FROM "Category" WHERE "slug" = 'hs-94'
UNION ALL SELECT '65015c59-b9c5-554b-92b0-b2ca47abce3e'::uuid, "id", 'kk', 'Жиһаз, төсек-орын және шамдар' FROM "Category" WHERE "slug" = 'hs-94'
UNION ALL SELECT '9316de1c-7dfc-5c0a-a90d-17d728dee24b'::uuid, "id", 'ru', 'Игрушки, игры и спортивный инвентарь' FROM "Category" WHERE "slug" = 'hs-95'
UNION ALL SELECT 'c4cd5184-0c26-540b-b19f-84f9f2e2f6ad'::uuid, "id", 'kk', 'Ойыншықтар, ойындар және спорт құралдары' FROM "Category" WHERE "slug" = 'hs-95'
UNION ALL SELECT 'd139d9d7-6d0a-5f57-b0e3-1332f2f607c7'::uuid, "id", 'ru', 'Прочие готовые изделия' FROM "Category" WHERE "slug" = 'hs-96'
UNION ALL SELECT 'e60efc17-1e0f-5ba0-8423-6b8662f596c3'::uuid, "id", 'kk', 'Басқа дайын бұйымдар' FROM "Category" WHERE "slug" = 'hs-96'
UNION ALL SELECT 'c1d8434c-2f2e-5e2f-917a-1bf8307cd3db'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-20'
UNION ALL SELECT 'a4661d29-77e4-53d7-bab3-68a8239bb8a7'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-20'
UNION ALL SELECT '895c746c-dee1-5704-801f-d953ef5bf400'::uuid, "id", 'ru', 'Произведения искусства и антиквариат' FROM "Category" WHERE "slug" = 'hs-section-21'
UNION ALL SELECT 'a8d21925-84eb-58ff-bc67-8a3d14ce74ff'::uuid, "id", 'kk', 'Өнер туындылары және антиквариат' FROM "Category" WHERE "slug" = 'hs-section-21'
UNION ALL SELECT 'dc8026d8-841f-541a-a3c2-0017f3ce05ea'::uuid, "id", 'ru', 'Произведения искусства и антиквариат' FROM "Category" WHERE "slug" = 'hs-97'
UNION ALL SELECT '736fb5cf-9f71-59ff-8fb9-1f2e0d6d62d9'::uuid, "id", 'kk', 'Өнер туындылары және антиквариат' FROM "Category" WHERE "slug" = 'hs-97'
UNION ALL SELECT 'cd56c948-53f2-5f17-a8d8-dcf1a1d3cd3b'::uuid, "id", 'ru', 'Прочее (нет в списке)' FROM "Category" WHERE "slug" = 'other-21'
UNION ALL SELECT 'b9a58c59-f07b-5e45-87ca-f84f1d097b37'::uuid, "id", 'kk', 'Басқасы (тізімде жоқ)' FROM "Category" WHERE "slug" = 'other-21'
ON CONFLICT ("category_id", "locale") DO NOTHING;
-- The original demo categories become leaves of their matching group (IDs and data unchanged).
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-11') WHERE "slug" = 'textile' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-16') WHERE "slug" = 'electronics' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-04') WHERE "slug" = 'food' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-10') WHERE "slug" = 'packaging' AND "parent_id" IS NULL;
UPDATE "Category" SET "parent_id" = (SELECT "id" FROM "Category" WHERE "slug" = 'hs-section-05') WHERE "slug" = 'energy-coal' AND "parent_id" IS NULL;
