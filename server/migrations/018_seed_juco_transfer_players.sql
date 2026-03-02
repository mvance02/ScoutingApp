-- Migration 018: Seed data for JUCO and Transfer tabs
-- Adds sample players to demonstrate JUCO and Transfer-specific features
-- Safe to re-run (only inserts if players don't already exist)

DO $$
BEGIN
  -- JUCO Player 1: High-impact defensive player
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Marcus Johnson' AND school = 'Snow College') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Marcus Johnson', 'DB', NULL, 'CB', 'Snow College', 'UT', '2025',
      'Elite speed and ball skills. Has offers from multiple P4 programs. Needs to improve tackling technique.',
      true, ARRAY['Offered', 'Interested'], 87.50, true, false, false,
      '2024-09-15', NULL,
      2, 'Discovered through JUCO showcase. Originally from Texas, went JUCO route after not qualifying academically out of HS.',
      'Can help now', 'Academic risk - needs to maintain grades. No off-field concerns.',
      'JUCO D1', 'Not in portal', NULL,
      '[{"school": "Utah", "interest": "High"}, {"school": "Oregon State", "interest": "Medium"}, {"school": "Boise State", "interest": "High"}]'::jsonb
    );
  END IF;

  -- JUCO Player 2: Developmental offensive lineman
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Jake Martinez' AND school = 'Arizona Western') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Jake Martinez', 'OL', 'OT', NULL, 'Arizona Western', 'AZ', '2026',
      'Big frame, needs to develop technique. High ceiling but raw.',
      true, ARRAY['Evaluating', 'Watching'], 82.00, true, false, true,
      NULL, NULL,
      3, 'Recommended by JUCO coach. Former HS standout who needed more development time.',
      'Developmental', 'Injury history - missed 3 games last season with ankle sprain.',
      'JUCO D1', 'Not in portal', NULL,
      '[{"school": "Utah State", "interest": "Low"}, {"school": "Weber State", "interest": "Medium"}]'::jsonb
    );
  END IF;

  -- JUCO Player 3: Ready-now running back
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Tyler Williams' AND school = 'East Mississippi CC') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Tyler Williams', 'RB', 'RB', NULL, 'East Mississippi CC', 'MS', '2025',
      'Explosive runner with good vision. Can contribute immediately in rotation.',
      true, ARRAY['Offered', 'Interested'], 89.25, true, false, false,
      '2024-10-01', NULL,
      2, 'Top JUCO RB in the country. Originally committed to SEC school but decommitted.',
      'Can help now', 'No major concerns. Clean record.',
      'JUCO D1', 'Expected to enter', 'Playing time - wants to be featured back',
      '[{"school": "Ole Miss", "interest": "High"}, {"school": "Mississippi State", "interest": "High"}, {"school": "Auburn", "interest": "Medium"}]'::jsonb
    );
  END IF;

  -- JUCO Player 4: Special teams ace
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Chris Anderson' AND school = 'Butte College') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Chris Anderson', 'ATH', 'WR', 'DB', 'Butte College', 'CA', '2025',
      'Versatile athlete. Excellent return specialist. Could play multiple positions.',
      false, ARRAY['Watching'], 80.50, true, false, false,
      NULL, NULL,
      1, 'JUCO All-American returner. Small school but big play ability.',
      'Emergency depth', 'Size concerns - only 5''9". May struggle against bigger competition.',
      'JUCO D2', 'Not in portal', NULL,
      '[{"school": "Fresno State", "interest": "Low"}, {"school": "San Jose State", "interest": "Low"}]'::jsonb
    );
  END IF;

  -- JUCO Player 5: Quarterback prospect
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Ryan Davis' AND school = 'Hutchinson CC') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Ryan Davis', 'QB', 'QB', NULL, 'Hutchinson CC', 'KS', '2026',
      'Strong arm, good mobility. Needs to improve decision-making under pressure.',
      true, ARRAY['Evaluating'], 84.75, true, false, true,
      NULL, NULL,
      3, 'JUCO coach reached out. Former 3-star recruit who went JUCO route.',
      'Developmental', 'Needs to improve accuracy. Some character questions from previous school.',
      'JUCO D1', 'Not in portal', NULL,
      '[{"school": "Kansas", "interest": "Medium"}, {"school": "Kansas State", "interest": "Low"}]'::jsonb
    );
  END IF;

  -- Transfer Player 1: P4 starter looking for new home
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Jordan Smith' AND school = 'USC') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Jordan Smith', 'WR', 'WR', NULL, 'USC', 'CA', '2026',
      'Former 4-star recruit. Started 8 games last season. Looking for better scheme fit.',
      true, ARRAY['Interested', 'Evaluating'], 91.00, false, true, false,
      NULL, NULL,
      2, 'Entered portal after coaching change. High priority target.',
      'Can help now', 'No major concerns. Clean record, good student.',
      'P4', 'In portal', 'Staff change - new OC doesn''t fit his skill set',
      '[{"school": "Oregon", "interest": "High"}, {"school": "Washington", "interest": "High"}, {"school": "Utah", "interest": "Medium"}]'::jsonb
    );
  END IF;

  -- Transfer Player 2: G5 rotation player
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Michael Brown' AND school = 'Boise State') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Michael Brown', 'LB', NULL, 'ILB', 'Boise State', 'ID', '2025',
      'Solid contributor but wants more playing time. Good instincts, needs to improve speed.',
      true, ARRAY['Watching'], 85.50, false, true, true,
      NULL, NULL,
      1, 'Expected to enter portal during spring window. Backup who wants to start.',
      'Emergency depth', 'Limited playing time at current school. May struggle with transition.',
      'G5', 'Expected to enter', 'Playing time - stuck behind upperclassmen',
      '[{"school": "Utah State", "interest": "Medium"}, {"school": "Wyoming", "interest": "Low"}]'::jsonb
    );
  END IF;

  -- Transfer Player 3: FCS standout
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'David Lee' AND school = 'Weber State') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'David Lee', 'DL', NULL, 'DE', 'Weber State', 'UT', '2026',
      'FCS All-Conference. Dominant at FCS level, question is if he can make jump to P4.',
      true, ARRAY['Interested', 'Evaluating'], 88.25, false, true, false,
      '2024-11-10', NULL,
      2, 'Local connection - from Utah. FCS coaches recommended him.',
      'Can help now', 'Level of competition concern. May need adjustment period.',
      'FCS', 'In portal', 'Location - wants to be closer to family',
      '[{"school": "Utah", "interest": "High"}, {"school": "BYU", "interest": "High"}, {"school": "Utah State", "interest": "Medium"}]'::jsonb
    );
  END IF;

  -- Transfer Player 4: Grad transfer quarterback
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Alex Thompson' AND school = 'Stanford') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Alex Thompson', 'QB', 'QB', NULL, 'Stanford', 'CA', '2025',
      'Grad transfer with one year left. Smart, accurate passer. Limited mobility.',
      true, ARRAY['Offered', 'Interested'], 86.75, false, true, false,
      '2024-12-01', NULL,
      1, 'Grad transfer portal. Looking for starting opportunity.',
      'Can help now', 'Age - will be 23. Limited upside but experienced.',
      'P4', 'In portal', 'Playing time - lost starting job to younger player',
      '[{"school": "Washington State", "interest": "High"}, {"school": "Oregon State", "interest": "Medium"}, {"school": "Cal", "interest": "Low"}]'::jsonb
    );
  END IF;

  -- Transfer Player 5: P4 backup defensive back
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Brandon Taylor' AND school = 'Oregon') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Brandon Taylor', 'DB', NULL, 'S', 'Oregon', 'OR', '2026',
      'Special teams standout. Limited defensive snaps but shows potential.',
      false, ARRAY['Watching'], 83.00, false, true, false,
      NULL, NULL,
      2, 'Expected to enter portal. Backup looking for more opportunity.',
      'Developmental', 'Limited game experience. May need time to adjust.',
      'P4', 'Expected to enter', 'Playing time - wants more defensive snaps',
      '[{"school": "Oregon State", "interest": "Low"}, {"school": "Portland State", "interest": "Medium"}]'::jsonb
    );
  END IF;

  -- Transfer Player 6: Committed elsewhere
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Kevin Johnson' AND school = 'Arizona State') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Kevin Johnson', 'OL', 'OG', NULL, 'Arizona State', 'AZ', '2026',
      'Strong interior lineman. Committed to another school but was high on our board.',
      false, ARRAY['Committed Elsewhere'], 87.00, false, true, false,
      '2024-09-20', '2024-12-15',
      2, 'Was in portal, we offered, but chose different program.',
      'Can help now', 'No concerns - just chose different opportunity.',
      'P4', 'Committed elsewhere', 'NIL - better NIL package at chosen school',
      '[{"school": "Arizona", "interest": "High"}, {"school": "Arizona State", "interest": "High"}]'::jsonb
    );
  END IF;

  -- Transfer Player 7: Withdrew from portal
  IF NOT EXISTS (SELECT 1 FROM players WHERE name = 'Sam Wilson' AND school = 'Colorado') THEN
    INSERT INTO players (
      name, position, offense_position, defense_position, school, state, grad_year,
      notes, flagged, recruiting_statuses, composite_rating, is_juco, is_transfer_wishlist,
      is_lds, offered_date, committed_date,
      eligibility_years_left, recruiting_context, immediate_impact_tag, risk_notes,
      current_school_level, portal_status, transfer_reason, other_offers
    ) VALUES (
      'Sam Wilson', 'TE', 'TE', NULL, 'Colorado', 'CO', '2025',
      'Entered portal but decided to stay at current school. Keeping on watch list.',
      false, ARRAY['Passed'], 84.50, false, true, false,
      NULL, NULL,
      1, 'Was in portal briefly, withdrew. May re-enter later.',
      'Emergency depth', 'Uncertainty - may or may not actually transfer.',
      'P4', 'Withdrew', 'Personal - family situation resolved',
      '[{"school": "Colorado State", "interest": "Low"}]'::jsonb
    );
  END IF;

  RAISE NOTICE 'Seed data migration completed. Added JUCO and Transfer players if they did not already exist.';
END $$;
