package io.github.coyotewolf.aoi.update;
import java.nio.file.*;import java.nio.channels.*;import java.io.IOException;
/** Shares apply.lock with the detached installer; never overwrites its plan. */
public final class UpdateLease implements AutoCloseable {
 private final FileChannel channel;private final FileLock lock;
 private UpdateLease(FileChannel channel,FileLock lock){this.channel=channel;this.lock=lock;}
 public static UpdateLease acquire(Path state){
  FileChannel channel=null;
  try{channel=FileChannel.open(state.resolve("apply.lock"),StandardOpenOption.CREATE,StandardOpenOption.WRITE);var lock=channel.tryLock();if(lock!=null)return new UpdateLease(channel,lock);}
  catch(IOException|OverlappingFileLockException ignored){}
  if(channel!=null)try{channel.close();}catch(IOException ignored){}return null;
 }
 @Override public void close()throws IOException{if(lock.isValid())lock.release();channel.close();}
}
