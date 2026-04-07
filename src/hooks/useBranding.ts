'use client'
import { getTenant } from '@/config/branding'
export function useBranding() { return getTenant() }
