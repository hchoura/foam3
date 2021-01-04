package net.nanopay.approval.test;

import foam.comics.v2.userfeedback.UserFeedbackException;
import foam.core.X;
import foam.dao.ArraySink;
import foam.dao.DAO;
import foam.nanos.approval.Approvable;
import foam.nanos.approval.ApprovalRequest;
import foam.nanos.approval.ApprovableAware;
import foam.nanos.approval.ApprovalStatus;
import foam.nanos.auth.LifecycleState;
import foam.nanos.auth.Subject;
import foam.nanos.auth.User;
import foam.nanos.auth.UserQueryService;
import foam.nanos.logger.Logger;
import foam.nanos.ruler.Operations;
import foam.nanos.test.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import net.nanopay.liquidity.crunch.RoleAssignment;
import net.nanopay.liquidity.crunch.RoleAssignmentOperations;
import net.nanopay.test.liquid.LiquidTestExecutor;

import static foam.mlang.MLang.*;

public class ApprovalTestExecutor extends LiquidTestExecutor {
  private ApprovalTestExecutorState[] states;

  public ApprovalTestExecutor(String prefix, ApprovalTestExecutorState[] testStates) {
    super(prefix);
    this.states = testStates;
  }

  public void runTest(X x) {
    // Setup contexts
    this.setup(x);

    // Get the expected actions and states for this test
    test(this.states != null, "Test states must be set");
    if (this.states == null)
      return;

    // Add a user
    this.logger.info(getTestPrefix(), "Creating user");
    User user = this.addUser(this.getFirstX());

    // Test approval request creation
    this.logger.info(getTestPrefix(), "Checking approval requests");
    Approvable approvable = this.testApprovableCreation(this.getSystemX(), user, ApprovalStatus.REQUESTED, false, Operations.CREATE);

    // Test approval request creation
    this.logger.info(getTestPrefix(), "Checking approval requests");
    ApprovalRequest request = this.testApprovalRequestCreation(this.getSystemX(), this.getSecondSystemUser(x), Operations.CREATE, approvable, null);

    // 01 - Approve / reject
    this.logger.info(getTestPrefix(), "Applying approval action", states[0].getApprovalStatus());
    this.applyApprovalAction(this.getSecondX(), states[0].getApprovalStatus(), request, Operations.CREATE);

    // Check status
    this.logger.info(getTestPrefix(), "Checking lifecycle state", states[0].getLifecycleState());
    user = this.checkUserStatus(this.getSystemX(), states[0].getLifecycleState(), user);

    // Stop the test if the user was rejected
    if (states[0].getApprovalStatus() == ApprovalStatus.REJECTED) {
      this.logger.info(getTestPrefix(), "Stopping test after creation rejection");
      return;
    }

    // Update the user
    this.logger.info(getTestPrefix(), "Updating the user");
    user = this.updateUser(this.getFirstX(), user);

    // Test approvable created
    this.logger.info(getTestPrefix(), "Checking requested approvables");
    approvable = this.testApprovableCreation(this.getSystemX(), user, ApprovalStatus.REQUESTED, false, Operations.UPDATE);

    // Test approval request creation
    this.logger.info(getTestPrefix(), "Checking approval requests");
    request = this.testApprovalRequestCreation(this.getSystemX(), this.getSecondSystemUser(x), Operations.UPDATE, approvable, null);

    // 02 - Approve / reject
    this.logger.info(getTestPrefix(), "Applying approval action", states[1].getApprovalStatus());
    this.applyApprovalAction(this.getSecondX(), states[1].getApprovalStatus(), request, Operations.UPDATE);

    // Validation
    this.logger.info(getTestPrefix(), "Validating requested approvables");
    this.testApprovableCreation(this.getSystemX(), user, states[1].getApprovalStatus(), states[1].getApprovalStatus() == ApprovalStatus.APPROVED, Operations.UPDATE);

    // Check status
    this.logger.info(getTestPrefix(), "Checking lifecycle state", states[1].getLifecycleState());
    user = this.checkUserStatus(this.getSystemX(), states[1].getLifecycleState(), user);

    // Remove the user
    this.logger.info(getTestPrefix(), "Removing the user");
    this.removeUser(this.getFirstX(), user);

    // Test approval request creation
    this.logger.info(getTestPrefix(), "Checking approval requests");
    request = this.testApprovalRequestCreation(this.getSystemX(), this.getSecondSystemUser(x), Operations.REMOVE, null, user);

    // 03 - Approve / reject
    this.logger.info(getTestPrefix(), "Applying approval action", states[2].getApprovalStatus());
    this.applyApprovalAction(this.getSecondX(), states[2].getApprovalStatus(), request, Operations.REMOVE);

    // Check status
    this.logger.info(getTestPrefix(), "Checking lifecycle state", states[2].getLifecycleState());
    user = this.checkUserStatus(this.getSystemX(), states[2].getLifecycleState(), user);
  }

  private ApprovalRequest getRequest(X x, Approvable approvable) {
    User xUser = ((Subject) x.get("subject")).getUser();

    List approvalRequests = ((ArraySink) getApprovalRequestDAO(x).inX(x).where(AND(
      EQ(ApprovalRequest.OBJ_ID, approvable.getId()),
      EQ(ApprovalRequest.CLASSIFICATION, "User"),
      EQ(ApprovalRequest.OPERATION, approvable.getOperation()),
      EQ(ApprovalRequest.APPROVER, xUser.getId())
    )).select(new ArraySink())).getArray();


    if ( approvalRequests.size() != 1 ){
      throw new RuntimeException("Something went wrong, there should be only one request for the user");
    }

    return (ApprovalRequest) approvalRequests.get(0);
  }

  private User addUser(X x) {
    // Email of the user for the test
    String email = this.getTestPrefix() + "approvaltestuser@nanopay.net";

    // Check if the user already exists
    User user = (User) getLocalUserDAO(x).inX(getSystemX()).find(EQ(User.EMAIL, email));
    test(user == null, "Checking if user already exists: " + email);

    // Create a new user
    user = new User.Builder(x)
      .setFirstName(this.getTestPrefix())
      .setLastName("Test")
      .setEmail(email)
      .setGroup("liquidBasic")
      .setJobTitle("Tester")
      .setOrganization("Acme")
      .setEnabled(true)
      .build();

    // Add to the context

    try {
      getLocalUserDAO(x).inX(x).put(user);
    }
    catch (RuntimeException ex)
    {
      boolean pass = false;

      if ( ex instanceof UserFeedbackException ) {
        var ufe = (UserFeedbackException) ex;
        if ( ufe.getUserFeedback().getMessage().equals("An approval request has been sent out."))
          pass = true;
      }

      test(pass, "Expecting approval exception: " + ex.getMessage());
    }

    return user;
  }

  private User updateUser(X x, User user) {
    // Clone the user
    user = (User) user.fclone();

    String oldLastName = user.getLastName();

    // Change a field
    test(!oldLastName.equals(this.getTestPrefix()), "Checking if last name already updated: " + this.getTestPrefix());
    user.setLastName(this.getTestPrefix());

    // Put the user
    try {
      getLocalUserDAO(x).inX(x).put(user);
    }
    catch (RuntimeException ex)
    {
      boolean pass = false;

      if ( ex instanceof UserFeedbackException ) {
        var ufe = (UserFeedbackException) ex;
        if ( ufe.getUserFeedback().getMessage().equals("An approval request has been sent out."))
          pass = true;
      }

      test(pass, "Expecting approval exception: " + ex.getMessage());
    }

    // Test that the user has not been updated
    User foundUser = (User) getLocalUserDAO(x).inX(x).find(user.getId());
    test(foundUser != null, "Checking if user found after unapproved update");
    test(foundUser.getLastName().equals(oldLastName), "Checking if last name updated before being approved: " + foundUser.getLastName());

    return user;
  }

  private void removeUser(X x, User user) {
    // call remove on the user
    try {
      getLocalUserDAO(x).inX(x).remove(user);
    }
    catch (RuntimeException ex)
    {
      boolean pass = false;

      if ( ex instanceof UserFeedbackException ) {
        var ufe = (UserFeedbackException) ex;
        if ( ufe.getUserFeedback().getMessage().equals("An approval request has been sent out."))
          pass = true;
      }

      test(pass, "Expecting approval exception: " + ex.getMessage());
    }

    // make sure the user still exists
    User foundUser = (User) getLocalUserDAO(x).inX(x).find(user.getId());
    test(foundUser != null, "Checking if user found after unapproved delete");
  }

  private ApprovalRequest testApprovalRequestCreation(X x, User approvingUser, Operations operation, Approvable approvable, User user) {
    // Request to return
    ApprovalRequest approvalRequest = null;

    ArraySink approvalRequests = (ArraySink) this.getApprovalRequestDAO(x).inX(this.getSystemX()).where(AND(
      EQ(ApprovalRequest.OBJ_ID, approvable != null ? approvable.getId() : String.valueOf(user.getId())),
      EQ(ApprovalRequest.CLASSIFICATION, "User"),
      EQ(ApprovalRequest.OPERATION, operation),
      EQ(ApprovalRequest.IS_FULFILLED, false)
    )).select(new ArraySink());

    // Make sure they are all set to REQUESTED
    List<Long> requestApproverIds = new ArrayList<>();
    for ( int j = 0; j < approvalRequests.getArray().size(); j++ ) {

      // Is it set to requested
      ApprovalRequest request = (ApprovalRequest) approvalRequests.getArray().get(j);

      // Skip fulfilled requests
      if (request.getIsFulfilled())
        continue;

      // Make sure any other requests are REQUESTED
      test(request.getStatus() == ApprovalStatus.REQUESTED, "ApprovalRequest(" + operation + ") set to " + request.getStatus() + ": " + request.getId() + ", user: " + request.getApprover());

      // Look for the approving user
      if (request.getApprover() == approvingUser.getId())
        approvalRequest = request;

      // Keep track off all the approvers
      requestApproverIds.add(request.getApprover());
    }

    // Remove the requestor from the set of approvers
    //requestApproverIds.remove(requestingUser.getId());
    Collections.sort(requestApproverIds);

    // Lookup all of the possible approvers
    List<Long> approverIds = this.getUserQueryService(x).getAllApprovers(x, User.getOwnClassInfo().getObjClass().getSimpleName());
    Collections.sort(approverIds);

    // Test to see if they match
    test(approverIds.equals(requestApproverIds), "Checking if UCJ approvers and approval requests approvers match");

    // Test that an approval request has been found for the approving user
    test(approvalRequest != null, "Checking if approval request found for approving user: " + approvingUser.getId());
    return approvalRequest;
  }

  private Approvable testApprovableCreation(X x, User user, ApprovalStatus expectedStatus,Boolean actionApplied, Operations operation) {
    String approvableHashKey = ApprovableAware.getApprovableHashKey(x, user, operation);

    String hashedId = new StringBuilder("d")
      .append("bareUserDAO")
      .append(":o")
      .append(user.getId())
      .append(":h")
      .append(approvableHashKey)
      .toString();


    // Find the approvable
    Approvable foundApprovable = (Approvable) this.getApprovableDAO(x).inX(x).find(
      EQ(Approvable.LOOKUP_ID, hashedId)
    );

    test(foundApprovable != null, "Checking if Approvable found after update");
    test(foundApprovable.getStatus() == expectedStatus, "Expected status: " + expectedStatus + ". Actual status: " + foundApprovable.getStatus());

    if ( operation == Operations.UPDATE ){
      // Test that the user has not been updated
      User foundUser = (User) getLocalUserDAO(x).inX(x).find(user.getId());
      test(foundUser != null, "Checking if user found for update applied check");

      // Check if the update should have been applied
      if (actionApplied)
        test(foundUser.getLastName().equals(this.getTestPrefix()), "Checking if the update (action) has been applied: " + actionApplied);
    } else if ( operation == Operations.CREATE ){
      // check that user is not in the user dao
      User foundUser = (User) getLocalUserDAO(x).inX(x).find(user.getId());

      if ( ! actionApplied ){
        test(foundUser == null, "Checking if user found before create approvable is approved");
      } else {
        test(foundUser != null, "Checking if user is found after create approvable is approved");
      }
    } else {
      throw new RuntimeException("Unexpected operation received for Approvable Creation test: " + operation);
    }

    return foundApprovable;
  }

  private void applyApprovalAction(X x, ApprovalStatus status, ApprovalRequest request, Operations operation) {
    test(request != null, "Checking if ApprovalRequest found for approving user: " + this.getTestPrefix());

    // Mark the request with the appropriate status
    request = (ApprovalRequest) request.fclone();
    request.setStatus(status);

    // Save the approval
    this.getApprovalRequestDAO(x).inX(x).put(request);

    // Check the approval
    ApprovalRequest foundRequest = (ApprovalRequest) this.getApprovalRequestDAO(x).inX(this.getSystemX()).find(request.getId());
    test(foundRequest.getStatus() == status, "Checking if ApprovalRequest status updated to: " + status + " - " + this.getTestPrefix());

    ArraySink approvalRequests = (ArraySink) this.getApprovalRequestDAO(x).inX(this.getSystemX()).where(AND(
      EQ(ApprovalRequest.OBJ_ID, request.getObjId()),
      EQ(ApprovalRequest.CLASSIFICATION, "User"),
      EQ(ApprovalRequest.OPERATION, operation)
    )).select(new ArraySink());
    test(approvalRequests.getArray().size() == 1, "Checking if more than 1 executed approval requests found: " + approvalRequests.getArray().size());

    ApprovalRequest approvedRequest = (ApprovalRequest) approvalRequests.getArray().get(0);
    test(approvedRequest.getStatus() == status, "Checking if found approval request status is: " + status + " - " + approvedRequest.getStatus());
  }

  private User checkUserStatus(X x, LifecycleState lifecycleState, User user) {
    User foundUser = (User) getLocalUserDAO(x).inX(x).find(user.getId());
    test(foundUser != null, "Checking if can find user to check lifecycle state: " + lifecycleState + " - " + this.getTestPrefix());

    // Check the lifecycle state
    test(foundUser.getLifecycleState() == lifecycleState, "Checking if found user lifecycle state is correct. Expected: " + lifecycleState + ". Actual: " + foundUser.getLifecycleState());
    return (User) foundUser.fclone();
  }
}