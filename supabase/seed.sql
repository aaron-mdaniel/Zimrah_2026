-- ==============================================================================
-- ZIMRAH 2026 – Master Data Seed Script (seed.sql)
-- Reproduces seed_master_data.py & create_prod_admin.py for Supabase
-- ==============================================================================

DO $$
DECLARE
    v_edition_id UUID;
    v_cat_literary UUID;
    v_cat_stage UUID;
    v_div_1 UUID;
    v_div_2 UUID;
    v_div_3 UUID;
    v_div_4 UUID;
    v_sec_jb UUID;
    v_sec_jg UUID;
    v_sec_sb UUID;
    v_sec_sg UUID;
    v_sec_junior UUID;
    v_sec_senior UUID;
    v_sec_open UUID;
    v_admin_user_id UUID;
BEGIN
    -- 1. Seed Initial Super Admin in auth.users and user_profiles
    v_admin_user_id := '00000000-0000-0000-0000-000000000001'::UUID;

    BEGIN
        INSERT INTO auth.users (id, email, created_at)
        VALUES (v_admin_user_id, 'admin@zimrah2026.org', now())
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.user_profiles (id, username, full_name, role, phone, is_active)
        VALUES (v_admin_user_id, 'admin', 'System Super Administrator', 'SUPER_ADMIN', '9447000000', TRUE)
        ON CONFLICT (id) DO UPDATE 
        SET role = 'SUPER_ADMIN', username = 'admin', is_active = TRUE;
    EXCEPTION WHEN foreign_key_violation THEN
        NULL;
    END;

    -- 2. Seed Festival Edition
    INSERT INTO public.editions (year, name, theme, organizer, start_date, end_date, is_active)
    VALUES (
        2026,
        'ZIMRAH 2026',
        'Song of Praise',
        'CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement',
        '2026-11-08',
        '2026-11-14',
        TRUE
    )
    ON CONFLICT (year) DO UPDATE 
    SET name = EXCLUDED.name, theme = EXCLUDED.theme, is_active = EXCLUDED.is_active
    RETURNING id INTO v_edition_id;

    -- 3. Seed Event Categories
    INSERT INTO public.event_categories (edition_id, name, name_malayalam, date, venue)
    VALUES 
        (v_edition_id, 'Literary Events', 'സാഹിത്യ മത്സരങ്ങൾ', '2026-11-08', 'Thazhathmon, TVM')
    ON CONFLICT (edition_id, name) DO UPDATE SET venue = EXCLUDED.venue
    RETURNING id INTO v_cat_literary;

    INSERT INTO public.event_categories (edition_id, name, name_malayalam, date, venue)
    VALUES 
        (v_edition_id, 'Stage Events', 'സ്റ്റേജ് മത്സരങ്ങൾ', '2026-11-14', 'St. Mathias CSI Church, Munroethuruth')
    ON CONFLICT (edition_id, name) DO UPDATE SET venue = EXCLUDED.venue
    RETURNING id INTO v_cat_stage;

    -- 4. Seed Event Divisions
    INSERT INTO public.event_divisions (edition_id, division_number, name, name_malayalam)
    VALUES 
        (v_edition_id, 1, 'Music', 'സംഗീതം (16 ഇനങ്ങൾ)')
    ON CONFLICT (edition_id, division_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_div_1;

    INSERT INTO public.event_divisions (edition_id, division_number, name, name_malayalam)
    VALUES 
        (v_edition_id, 2, 'Fine Arts', 'ഫൈൻ ആർട്സ് (3 ഇനങ്ങൾ)')
    ON CONFLICT (edition_id, division_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_div_2;

    INSERT INTO public.event_divisions (edition_id, division_number, name, name_malayalam)
    VALUES 
        (v_edition_id, 3, 'Theater', 'തീയറ്റർ മത്സരങ്ങൾ (5 ഇനങ്ങൾ)')
    ON CONFLICT (edition_id, division_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_div_3;

    INSERT INTO public.event_divisions (edition_id, division_number, name, name_malayalam)
    VALUES 
        (v_edition_id, 4, 'Writing & Elocution', 'രചന പ്രസംഗ മത്സരങ്ങൾ (10 ഇനങ്ങൾ)')
    ON CONFLICT (edition_id, division_number) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_div_4;

    -- 5. Seed Event Sections
    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'JB', 'Junior Boys', 'ജൂനിയർ ബോയ്സ്')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_jb;

    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'JG', 'Junior Girls', 'ജൂനിയർ ഗേൾസ്')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_jg;

    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'SB', 'Senior Boys', 'സീനിയർ ബോയ്സ്')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_sb;

    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'SG', 'Senior Girls', 'സീനിയർ ഗേൾസ്')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_sg;

    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'JUNIOR', 'Junior', 'ജൂനിയർ')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_junior;

    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'SENIOR', 'Senior', 'സീനിയർ')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_senior;

    INSERT INTO public.event_sections (edition_id, code, name, name_malayalam)
    VALUES (v_edition_id, 'OPEN', 'Open', 'പൊതു വിഭാഗം')
    ON CONFLICT (edition_id, code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_sec_open;

    -- 6. Seed All 34 Official Competitions
    -- Division 1: Music (EV01 - EV16)
    INSERT INTO public.events (edition_id, code, name, name_malayalam, category_id, division_id, section_id, event_type, duration_minutes, duration_display, min_participants, max_participants, contributes_to_individual, contributes_to_church)
    VALUES
        (v_edition_id, 'EV01', 'Solo Eastern - Junior Boys', 'സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്', v_cat_stage, v_div_1, v_sec_jb, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV02', 'Solo Eastern - Junior Girls', 'സോളോ ഈസ്റ്റേൺ - ജൂനിയർ - ഗേൾസ്', v_cat_stage, v_div_1, v_sec_jg, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV03', 'Solo Eastern - Senior Boys', 'സോളോ ഈസ്റ്റേൺ - സീനിയർ - ബോയ്സ്', v_cat_stage, v_div_1, v_sec_sb, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV04', 'Solo Eastern - Senior Girls', 'സോളോ ഈസ്റ്റേൺ - സീനിയർ - ഗേൾസ്', v_cat_stage, v_div_1, v_sec_sg, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV05', 'Solo Western - Junior Boys', 'സോളോ വെസ്റ്റേൺ - ജൂനിയർ - ബോയ്സ്', v_cat_stage, v_div_1, v_sec_jb, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV06', 'Solo Western - Junior Girls', 'സോളോ വെസ്റ്റേൺ - ജൂനിയർ - ഗേൾസ്', v_cat_stage, v_div_1, v_sec_jg, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV07', 'Solo Western - Senior Boys', 'സോളോ വെസ്റ്റേൺ - സീനിയർ - ബോയ്സ്', v_cat_stage, v_div_1, v_sec_sb, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV08', 'Solo Western - Senior Girls', 'സോളോ വെസ്റ്റേൺ - സീനിയർ - ഗേൾസ്', v_cat_stage, v_div_1, v_sec_sg, 'INDIVIDUAL', NULL, '', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV09', 'Light Music - Girls', 'ലളിതഗാനം - ഗേൾസ്', v_cat_stage, v_div_1, v_sec_open, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV10', 'Light Music - Boys', 'ലളിതഗാനം - ബോയ്സ്', v_cat_stage, v_div_1, v_sec_open, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV11', 'Classical Music', 'ശാസ്ത്രീയ സംഗീതം', v_cat_stage, v_div_1, v_sec_open, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV12', 'Organ Recital', 'ഓർഗൻ റിസൈറ്റൽ', v_cat_stage, v_div_1, v_sec_open, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV13', 'Instrumental Music (Percussion)', 'ഉപകരണ സംഗീതം (പെർക്യൂഷൻ)', v_cat_stage, v_div_1, v_sec_open, 'INDIVIDUAL', 8, '3+5 മിനിറ്റ്സ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV14', 'Instrumental Music (Violin)', 'ഉപകരണ സംഗീതം (വയലിൻ)', v_cat_stage, v_div_1, v_sec_open, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV15', 'Group Song', 'സമൂഹഗാനം', v_cat_stage, v_div_1, v_sec_open, 'GROUP', 5, '5 മിനിറ്റ്', 4, 12, TRUE, TRUE),
        (v_edition_id, 'EV16', 'Quartet', 'ക്വാർട്ടറ്റ്', v_cat_stage, v_div_1, v_sec_open, 'GROUP', NULL, '', 4, 4, TRUE, TRUE),

        -- Division 2: Fine Arts (EV17 - EV19)
        (v_edition_id, 'EV17', 'Pencil Drawing', 'പെൻസിൽ ഡ്രോയിംഗ്', v_cat_literary, v_div_2, v_sec_open, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV18', 'Water Colour', 'വാട്ടർ കളർ', v_cat_literary, v_div_2, v_sec_open, 'INDIVIDUAL', 75, '75 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV19', 'Cartoon', 'കാർട്ടൂൺ', v_cat_literary, v_div_2, v_sec_open, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),

        -- Division 3: Theater (EV20 - EV24)
        (v_edition_id, 'EV20', 'Fancy Dress', 'ഫാൻസി ഡ്രസ്സ്', v_cat_stage, v_div_3, v_sec_open, 'INDIVIDUAL', 3, '3 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV21', 'Mime', 'മൂകാഭിനയം (മൈം)', v_cat_stage, v_div_3, v_sec_open, 'GROUP', 5, '5 മിനിറ്റ്', 1, 6, TRUE, TRUE),
        (v_edition_id, 'EV22', 'Mono Act', 'മോണോ ആക്ട്', v_cat_stage, v_div_3, v_sec_open, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV23', 'Tableau', 'ടാബ്ലോ', v_cat_stage, v_div_3, v_sec_open, 'GROUP', 7, '7 മിനിറ്റ്', 4, 15, TRUE, TRUE),
        (v_edition_id, 'EV24', 'Skit', 'സ്കിറ്റ്', v_cat_stage, v_div_3, v_sec_open, 'GROUP', 10, '10 മിനിറ്റ്', 4, 8, TRUE, TRUE),

        -- Division 4: Writing & Elocution (EV25 - EV34)
        (v_edition_id, 'EV25', 'Story Writing (Malayalam)', 'കഥാരചന (മലയാളം)', v_cat_literary, v_div_4, v_sec_open, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV26', 'Poem Writing (Malayalam)', 'കവിതാരചന (മലയാളം)', v_cat_literary, v_div_4, v_sec_open, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV27', 'Story Writing (English)', 'കഥാരചന (ഇംഗ്ലീഷ്)', v_cat_literary, v_div_4, v_sec_open, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV28', 'Poem Writing (English)', 'കവിതാരചന (ഇംഗ്ലീഷ്)', v_cat_literary, v_div_4, v_sec_open, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV29', 'Essay Writing - Junior (Malayalam)', 'ഉപന്യാസ രചന ജൂനിയർ (മലയാളം)', v_cat_literary, v_div_4, v_sec_junior, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV30', 'Essay Writing - Senior (English)', 'ഉപന്യാസ രചന സീനിയർ (ഇംഗ്ലീഷ്)', v_cat_literary, v_div_4, v_sec_senior, 'INDIVIDUAL', 60, '60 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV31', 'Elocution - Junior (Malayalam)', 'പ്രസംഗം ജൂനിയർ (മലയാളം)', v_cat_literary, v_div_4, v_sec_junior, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV32', 'Elocution - Senior (Malayalam)', 'പ്രസംഗം സീനിയർ (മലയാളം)', v_cat_literary, v_div_4, v_sec_senior, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV33', 'Elocution - Junior (English)', 'പ്രസംഗം ജൂനിയർ (ഇംഗ്ലീഷ്)', v_cat_literary, v_div_4, v_sec_junior, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE),
        (v_edition_id, 'EV34', 'Elocution - Senior (English)', 'പ്രസംഗം സീനിയർ (ഇംഗ്ലീഷ്)', v_cat_literary, v_div_4, v_sec_senior, 'INDIVIDUAL', 5, '5 മിനിറ്റ്', 1, 1, TRUE, TRUE)
    ON CONFLICT (edition_id, code) DO UPDATE 
    SET name = EXCLUDED.name, 
        name_malayalam = EXCLUDED.name_malayalam,
        category_id = EXCLUDED.category_id,
        division_id = EXCLUDED.division_id,
        section_id = EXCLUDED.section_id,
        min_participants = EXCLUDED.min_participants,
        max_participants = EXCLUDED.max_participants;

    -- 7. Seed All 8 Parish Churches of Adoor Clergy District
    INSERT INTO public.churches (code, name, name_malayalam, district, vicar_name, contact_phone, is_active)
    VALUES
        ('CH01', 'St. Mathias CSI Church, Munroethuruth', 'സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്', 'Adoor Clergy District', 'Rev. John Philip', '9447100001', TRUE),
        ('CH02', 'Holy Trinity CSI Church, Adoor', 'ഹോളി ട്രിനിറ്റി സി.എസ്.ഐ ചർച്ച്, അടൂർ', 'Adoor Clergy District', 'Rev. Thomas Mathew', '9447100002', TRUE),
        ('CH03', 'St. Thomas CSI Church, Kannamkode', 'സെന്റ് തോമസ് സി.എസ്.ഐ ചർച്ച്, കണ്ണങ്കോട്', 'Adoor Clergy District', 'Rev. P. K. George', '9447100003', TRUE),
        ('CH04', 'All Saints CSI Church, Thazhathmon', 'ഓൾ സെയിന്റ്സ് സി.എസ്.ഐ ചർച്ച്, താഴത്തുമൺ', 'Adoor Clergy District', 'Rev. Abraham Varghese', '9447100004', TRUE),
        ('CH05', 'Christ Church CSI, Anandappally', 'ക്രൈസ്റ്റ് ചർച്ച് സി.എസ്.ഐ, ആനന്ദപ്പള്ളി', 'Adoor Clergy District', 'Rev. Jacob Koshy', '9447100005', TRUE),
        ('CH06', 'St. Mark CSI Church, Peringanadu', 'സെന്റ് മാർക്ക് സി.എസ്.ഐ ചർച്ച്, പെരിങ്ങനാട്', 'Adoor Clergy District', 'Rev. Sam George', '9447100006', TRUE),
        ('CH07', 'St. Luke CSI Church, Kadampanad', 'സെന്റ് ലൂക്ക് സി.എസ്.ഐ ചർച്ച്, കടമ്പനാട്', 'Adoor Clergy District', 'Rev. Varghese Philip', '9447100007', TRUE),
        ('CH08', 'St. Stephen CSI Church, Parakode', 'സെന്റ് സ്റ്റീഫൻ സി.എസ്.ഐ ചർച്ച്, പറക്കോട്', 'Adoor Clergy District', 'Rev. Sunny Varghese', '9447100008', TRUE)
    ON CONFLICT (code) DO UPDATE 
    SET name = EXCLUDED.name, 
        name_malayalam = EXCLUDED.name_malayalam,
        vicar_name = EXCLUDED.vicar_name,
        contact_phone = EXCLUDED.contact_phone,
        is_active = TRUE;

END $$;
