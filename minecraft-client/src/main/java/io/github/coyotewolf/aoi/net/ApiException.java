package io.github.coyotewolf.aoi.net;

import io.github.coyotewolf.aoi.model.Models;

public final class ApiException extends RuntimeException {
 public final int status;
 public final String retryAt;
 public ApiException(int status,String message,String retryAt){super(Models.safe(message,240));this.status=status;this.retryAt=Models.safe(retryAt,80);}
 public String display(){return getMessage()+(retryAt.isBlank()?"":" 可重試時間："+retryAt);}
}
