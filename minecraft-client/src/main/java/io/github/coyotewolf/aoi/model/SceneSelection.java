package io.github.coyotewolf.aoi.model;
import com.google.gson.*;
import java.util.*;
/** Keep a distant visible species from being crowded out by many nearby duplicates. */
public final class SceneSelection {
 public static JsonArray choose(List<JsonObject> rows,int limit){
  var selected=new LinkedHashSet<Integer>();var types=new HashSet<String>();
  for(int i=0;i<rows.size()&&selected.size()<limit;i++){
   var row=rows.get(i);String type=row.has("item")?"item:"+row.getAsJsonObject("item").get("id").getAsString():"entity:"+row.get("id").getAsString();
   if(types.add(type))selected.add(i);
  }
  for(int i=0;i<rows.size()&&selected.size()<limit;i++)selected.add(i);
  var result=new JsonArray();for(int index:selected)result.add(rows.get(index).deepCopy());return result;
 }
 private SceneSelection(){}
}
