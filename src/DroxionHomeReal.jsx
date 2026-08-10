import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Compass, Radio, MessageCircle, User, Video, BadgeCheck, UserPlus, UserCheck, Send } from 'lucide-react';
import { supabase } from './supabaseClient';
import DroxionProfile from './DroxionProfile';
import DroxionWallet from './DroxionWallet';
import './real-home