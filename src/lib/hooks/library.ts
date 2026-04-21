'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { getQuerySchoolId } from './utils'
import { isDemoSchool } from '@/lib/demo-utils'
import { DEMO_BOOKS, DEMO_BOOK_ISSUES } from '@/lib/demo-data'

export function useLibrary(schoolId?: string) {
  const [books, setBooks] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { isDemo } = useAuth()

  useEffect(() => {
    async function fetchData() {
      if (!schoolId) { setLoading(false); return }

      if (isDemo || isDemoSchool(schoolId)) {
        setBooks(DEMO_BOOKS as any)
        setIssues(DEMO_BOOK_ISSUES as any)
        setLoading(false)
        return
      }

      const querySchoolId = getQuerySchoolId(schoolId, isDemo)
      try {
        setLoading(true)
        const [booksRes, issuesRes] = await Promise.all([
          supabase.from('library_books').select('*').eq('school_id', querySchoolId).order('title'),
          supabase.from('library_issues').select('*, students(id, first_name, last_name)').eq('school_id', querySchoolId).order('issued_date', { ascending: false }),
        ])
        if (booksRes.error && booksRes.error.code !== '42P01' && booksRes.error.code !== '42501' && booksRes.error.code !== 'PGRST116') {
          console.error('Error fetching library books:', booksRes.error.message)
        }
        if (issuesRes.error && issuesRes.error.code !== '42P01' && issuesRes.error.code !== '42501' && issuesRes.error.code !== 'PGRST116') {
          console.error('Error fetching library issues:', issuesRes.error.message)
        }
        setBooks(booksRes.data || [])
        setIssues(issuesRes.data || [])
      } catch (err) {
        console.error('Error fetching library data:', err instanceof Error ? err.message : 'unknown')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [schoolId, isDemo])

  const addBook = async (book: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newBook = { ...book, id: `demo-book-${Date.now()}`, school_id: schoolId || '00000000-0000-0000-0000-000000000001' }
      setBooks(prev => [...prev, newBook])
      return newBook
    }
    try {
      const { data, error } = await supabase.from('library_books').insert({ ...book, school_id: schoolId }).select().single()
      if (error) throw error
      setBooks(prev => [...prev, data])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  const issueBook = async (issue: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newIssue = { ...issue, id: `demo-issue-${Date.now()}`, status: 'issued' }
      setIssues(prev => [...prev, newIssue])
      return newIssue
    }
    try {
      const { data, error } = await supabase.from('library_issues').insert({ ...issue, school_id: schoolId }).select().single()
      if (error) throw error
      setIssues(prev => [...prev, data])
      return data
    } catch (err: any) { throw new Error(err.message) }
  }

  return { books, issues, loading, addBook, issueBook }
}
