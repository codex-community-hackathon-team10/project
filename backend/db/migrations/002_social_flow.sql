CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  campus_id TEXT NOT NULL REFERENCES campuses(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('RESTAURANT','CAFE','STUDY_SPACE')),
  walk_minutes SMALLINT NOT NULL CHECK (walk_minutes >= 0),
  price_range TEXT NOT NULL CHECK (price_range IN ('UNDER_10000','AROUND_15000','FLEXIBLE')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS meeting_proposals (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  receiver_id TEXT NOT NULL REFERENCES users(id),
  meeting_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  activity TEXT NOT NULL CHECK (activity = 'LUNCH'),
  venue_type TEXT NOT NULL CHECK (venue_type IN ('RECOMMENDED','CUSTOM')),
  venue_id TEXT NULL REFERENCES venues(id),
  venue_name TEXT NOT NULL,
  venue_walk_minutes SMALLINT NULL,
  venue_price_range TEXT NULL CHECK (venue_price_range IN ('UNDER_10000','AROUND_15000','FLEXIBLE')),
  message TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED','CANCELED')),
  created_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ NULL,
  canceled_by TEXT NULL REFERENCES users(id),
  CHECK (sender_id <> receiver_id),
  CHECK ((venue_type = 'RECOMMENDED' AND venue_id IS NOT NULL AND venue_walk_minutes IS NOT NULL AND venue_price_range IS NOT NULL) OR (venue_type = 'CUSTOM' AND venue_id IS NULL AND venue_walk_minutes IS NULL AND venue_price_range IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_venues_campus_active ON venues(campus_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meeting_proposals_participant_date ON meeting_proposals(sender_id, meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_proposals_receiver_date ON meeting_proposals(receiver_id, meeting_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_proposal_pair_time ON meeting_proposals (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), meeting_date, start_time, end_time) WHERE status = 'PENDING';
