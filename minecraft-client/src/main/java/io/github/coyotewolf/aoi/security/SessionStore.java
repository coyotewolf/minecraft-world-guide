package io.github.coyotewolf.aoi.security;

import com.google.gson.JsonObject;
import java.io.IOException;

public interface SessionStore {
 JsonObject load() throws IOException;
 void save(JsonObject saved) throws IOException;
 void delete() throws IOException;
 SessionStore MEMORY=new SessionStore(){
  public JsonObject load(){return null;}
  public void save(JsonObject saved){}
  public void delete(){}
 };
}
