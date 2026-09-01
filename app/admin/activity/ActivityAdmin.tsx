"use client";
import { useCallback, useEffect, useState } from "react";
import { ArchiveIcon, ArchiveShell } from "@/app/archive/ArchiveShell";

type Log = { id:string; actor:string; action:string; targetType:string; targetId:string; summary:string; details:Record<string,string>; createdAt:string };
export default function ActivityAdmin({ userEmail }: { userEmail: string }) {
  const [logs,setLogs]=useState<Log[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(20),[query,setQuery]=useState(""),[selected,setSelected]=useState<Log|null>(null);
  const load=useCallback(async()=>{const params=new URLSearchParams({page:String(page),pageSize:String(pageSize),q:query});const response=await fetch(`/api/admin/activity?${params}`,{cache:"no-store"});if(response.ok){const data=await response.json();setLogs(data.logs??[]);setTotal(data.total??0)}},[page,pageSize,query]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),180);return()=>clearTimeout(timer)},[load]);
  const pages=Math.max(1,Math.ceil(total/pageSize));
  return <ArchiveShell admin active="activity" account={<a className="header-action-link" href="/api/archive/admin/session" aria-label="로그아웃"><ArchiveIcon name="logout" size={17} className="mobile-header-action-icon" /><span>로그아웃</span></a>}>
    <section className="archive-activity">
      <header className="cms-page-head"><div className="cms-page-title"><h1>활동 기록</h1><p>{userEmail} · 민감한 URL과 인증 정보는 기록하지 않습니다.</p></div></header>
      <div className="activity-summary"><article className="admin-card"><small>전체 기록</small><strong>{total}</strong></article><article className="admin-card"><small>현재 페이지</small><strong>{page}</strong></article><article className="admin-card"><small>표시 개수</small><strong>{pageSize}</strong></article></div>
      <div className="activity-filters"><input value={query} onChange={(event)=>{setQuery(event.target.value);setPage(1)}} placeholder="관리자, 작업, 내용 검색"/><select value={pageSize} onChange={(event)=>{setPageSize(Number(event.target.value));setPage(1)}}><option value="20">20개씩</option><option value="50">50개씩</option><option value="100">100개씩</option></select></div>
      <section className="admin-card"><div className="table-wrap"><table className="admin-table activity-table"><thead><tr><th>일시</th><th>관리자</th><th>작업</th><th>대상</th><th>내용</th></tr></thead><tbody>{logs.map((log)=><tr key={log.id} onClick={()=>setSelected(log)} tabIndex={0}><td>{log.createdAt.replace("T"," ")}</td><td>{log.actor}</td><td><b>{log.action}</b></td><td>{log.targetType}</td><td>{log.summary}</td></tr>)}</tbody></table>{!logs.length&&<div className="archive-empty">아직 기록된 활동이 없습니다.</div>}</div></section>
      <div className="pager"><span>{total}개 중 {Math.min((page-1)*pageSize+1,total)}-{Math.min(page*pageSize,total)}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>이전</button><b>{page} / {pages}</b><button disabled={page>=pages} onClick={()=>setPage(page+1)}>다음</button></div></div>
      {selected&&<div className="activity-detail-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&setSelected(null)}><aside className="activity-detail-panel"><button aria-label="닫기" onClick={()=>setSelected(null)}>×</button><small>ACTIVITY DETAIL</small><h2>{selected.summary}</h2><dl><dt>관리자</dt><dd>{selected.actor}</dd><dt>작업</dt><dd>{selected.action}</dd><dt>대상</dt><dd>{selected.targetType} · {selected.targetId||"—"}</dd><dt>세부 정보</dt><dd>{Object.entries(selected.details).map(([key,value])=><span key={key}>{key}: {value}</span>)}</dd></dl></aside></div>}
    </section>
  </ArchiveShell>;
}
