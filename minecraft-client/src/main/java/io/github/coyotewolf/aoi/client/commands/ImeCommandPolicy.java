package io.github.coyotewolf.aoi.client.commands;

import java.util.function.Consumer;

/** Changes only the active edit state; never changes a global IME setting. */
public final class ImeCommandPolicy {
 private String lastText="";
 private int lastCaret=-1;
 private boolean owned;
 public void update(String text,int caret,boolean disabledInCommands,Consumer<Boolean> editing){
  boolean ai=disabledInCommands&&CommandRoutes.owns(text);
  if(ai&&(!owned||!lastText.equals(text)||lastCaret!=caret))editing.accept(true);
  else if(owned&&!ai)editing.accept(!disabledInCommands||!text.stripLeading().startsWith("/"));
  owned=ai;lastText=text;lastCaret=caret;
 }
 public void reset(){owned=false;lastText="";lastCaret=-1;}
}
