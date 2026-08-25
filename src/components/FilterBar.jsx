import { Search } from "lucide-react";
import { GRADES, SUBJECTS } from "../data/catalog";
export default function FilterBar({ search, setSearch, grade, setGrade, subject, setSubject }) {
  return <div className="filter-bar">
    <label className="search-box"><Search size={18}/><input aria-label="Search" placeholder="Search lessons and games…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <select aria-label="Filter by grade" value={grade} onChange={e=>setGrade(e.target.value)}><option>All Grades</option>{GRADES.map(g=><option key={g}>{g}</option>)}</select>
    <select aria-label="Filter by subject" value={subject} onChange={e=>setSubject(e.target.value)}><option>All Subjects</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select>
  </div>;
}
