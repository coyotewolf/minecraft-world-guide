package io.github.coyotewolf.aoi.client.commands;
import io.github.coyotewolf.aoi.model.Models.Message;
import java.util.*;
/** Source indexes belong to one conversation and only currently loaded replies. */
public final class ReplySources {
 private String conversation="";private int next=1,latest;
 private final LinkedHashMap<Integer,Message> rows=new LinkedHashMap<>();
 public void clear(){rows.clear();conversation="";next=1;latest=0;}
 public void sync(String cid,List<Message> messages){
  if(!conversation.equals(cid)){clear();conversation=cid;}
  var all=messages.stream().filter(m->m.role().equals("assistant")).toList();var selected=all.subList(Math.max(0,all.size()-64),all.size());
  var ids=new HashSet<String>();for(var m:selected)if(m.role().equals("assistant"))ids.add(m.id());
  rows.entrySet().removeIf(e->!ids.contains(e.getValue().id()));latest=0;
  for(var m:selected)if(m.role().equals("assistant")){
   Integer key=rows.entrySet().stream().filter(e->e.getValue().id().equals(m.id())).map(Map.Entry::getKey).findFirst().orElse(null);
   if(key==null)key=next++;rows.put(key,m);latest=key;
   while(rows.size()>64)rows.remove(rows.keySet().iterator().next());
  }
 }
 public Message get(int index){return rows.get(index);}
 public int latestIndex(){return latest;}
}
